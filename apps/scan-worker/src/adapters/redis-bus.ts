import { Redis } from 'ioredis';
import { ControlMessage, type RedisBus, type Unsubscribe, type Logger } from '../ports.js';

/**
 * Redis control bus (Task 84) — the `scan:ctl:<jobId>` subscription.
 *
 * A DEDICATED connection per subscription, because a Redis connection in
 * subscriber mode cannot issue ordinary commands; sharing one connection across
 * concurrent scans would break both the subscription and the semaphore.
 *
 * Every inbound payload is parsed with the contract's `ControlMessage` schema
 * and anything that does not match is dropped and logged. That matters more than
 * it looks: the channel is a shared Redis keyspace, so a malformed or malicious
 * publish must not be able to drive the runner. Only `abort`, `pause`, `resume`
 * and `kill` exist.
 */

export interface IoRedisBusOptions {
  url: string;
  logger: Logger;
  /** Test seam. */
  createConnection?: (url: string) => Pick<Redis, 'subscribe' | 'on' | 'quit'> & {
    onMessage?: (channel: string, message: string) => void;
  };
}

type SubscriberConnection = {
  subscribe(channel: string): Promise<unknown>;
  on(event: 'message', listener: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
};

export class IoRedisBus implements RedisBus {
  private readonly options: IoRedisBusOptions;

  constructor(options: IoRedisBusOptions) {
    this.options = options;
  }

  private connect(): SubscriberConnection {
    if (this.options.createConnection !== undefined) {
      return this.options.createConnection(this.options.url) as SubscriberConnection;
    }
    return new Redis(this.options.url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    }) as unknown as SubscriberConnection;
  }

  async subscribe(
    channel: string,
    onMessage: (message: ControlMessage) => void,
  ): Promise<Unsubscribe> {
    const connection = this.connect();
    const logger = this.options.logger;

    connection.on('message', (messageChannel: string, raw: string) => {
      if (messageChannel !== channel) return;
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        logger.warn('dropping non-JSON control message', { channel });
        return;
      }
      const parsed = ControlMessage.safeParse(parsedJson);
      if (!parsed.success) {
        // An unknown shape is dropped, never guessed at.
        logger.warn('dropping unrecognised control message', { channel, raw: raw.slice(0, 200) });
        return;
      }
      onMessage(parsed.data);
    });

    await connection.subscribe(channel);
    logger.debug('subscribed to control channel', { channel });

    let closed = false;
    return async () => {
      if (closed) return;
      closed = true;
      try {
        await connection.quit();
      } catch (error) {
        logger.warn('failed to close the control subscription', {
          channel,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };
  }
}
