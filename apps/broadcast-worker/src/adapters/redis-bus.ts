import type { BroadcastProgressEvent } from '@vunvault/contracts';
import { broadcastProgressChannel } from '@vunvault/contracts';
import type { Logger, ProgressBus } from '../ports.js';

/**
 * Redis Pub/Sub progress bus (Task 89).
 *
 * Publishes `BroadcastProgressEvent` frames to `broadcast:progress:<id>` — the
 * channel the Task 94 SSE relay subscribes to. Publishing is fire-and-forget
 * with the error swallowed at the call site (`delivery.ts`): progress frames
 * are telemetry, and a Redis blip must never fail a SEV-1 delivery.
 */

export interface ProgressRedis {
  publish(channel: string, payload: string): Promise<unknown>;
}

export class RedisProgressBus implements ProgressBus {
  constructor(
    private readonly redis: ProgressRedis,
    private readonly logger: Logger,
  ) {}

  async publish(event: BroadcastProgressEvent): Promise<void> {
    try {
      await this.redis.publish(broadcastProgressChannel(event.broadcastId), JSON.stringify(event));
    } catch (error) {
      this.logger.warn('progress frame dropped', {
        broadcastId: event.broadcastId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
