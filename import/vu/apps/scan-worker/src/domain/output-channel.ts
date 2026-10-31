/**
 * Output channel naming (Task 88).
 *
 * The exact Redis keys the controller publishes to and the API's WebSocket relay
 * (Layer L12) subscribes to. They live in one module on each side of the wire by
 * necessity — the controller cannot import from `apps/api` — but the NAMES and
 * the payload shapes come from `@vunvault/contracts` (`scan-stream.ts`), which
 * both sides do import, so the two cannot drift.
 *
 * Three channels per job:
 *  - `scan:out:<jobId>`  — live Pub/Sub, every `ScanStreamMessage`.
 *  - `scan:buf:<jobId>`  — a Redis LIST replay buffer for late joiners and
 *    reconnects: `RPUSH` + `LTRIM` to the last 2 000 entries + `EXPIRE` 1 h.
 *  - `scan:ctl:<jobId>`  — inbound control (Task 84), four message types only.
 */

import type { ScanStreamMessage } from '@vunvault/contracts';
import {
  SCAN_REPLAY_BUFFER_LENGTH,
  SCAN_REPLAY_TTL_SECONDS,
  isReplayed,
} from '@vunvault/contracts';

export const liveChannel = (jobId: string): string => `scan:out:${jobId}`;
export const replayBufferKey = (jobId: string): string => `scan:buf:${jobId}`;
export const controlChannel = (jobId: string): string => `scan:ctl:${jobId}`;

export { SCAN_REPLAY_BUFFER_LENGTH, SCAN_REPLAY_TTL_SECONDS };

export type { ScanStreamMessage };

/**
 * The minimal Redis surface the channel needs.
 *
 * Deliberately tiny so a test fake is honest: `publish` for the live channel and
 * the three list commands for the replay buffer. Nothing else may be reachable
 * from here — in particular no `keys`, no `flushdb`, no `eval`.
 */
export interface OutputRedis {
  publish(channel: string, payload: string): Promise<unknown>;
  rpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface OutputChannel {
  /** Publish live, and buffer the message when it is replayable. */
  send(message: ScanStreamMessage): Promise<void>;
}

export interface OutputChannelOptions {
  redis: OutputRedis;
  jobId: string;
  /** Test seam: record without publishing. */
  onPublish?: (channel: string, payload: string) => void;
  bufferLength?: number;
  ttlSeconds?: number;
}

/**
 * Build the per-job output channel.
 *
 * A publish failure is swallowed after logging: the scan must not die because a
 * viewer disconnected. The buffered copy is what a reconnecting viewer replays,
 * so losing one live message is recoverable while aborting a 15-minute scan is
 * not.
 */
export function createOutputChannel(
  options: OutputChannelOptions,
  onError: (error: unknown) => void,
): OutputChannel {
  const live = liveChannel(options.jobId);
  const buffer = replayBufferKey(options.jobId);
  const length = options.bufferLength ?? SCAN_REPLAY_BUFFER_LENGTH;
  const ttl = options.ttlSeconds ?? SCAN_REPLAY_TTL_SECONDS;

  return {
    async send(message: ScanStreamMessage): Promise<void> {
      const payload = JSON.stringify(message);
      options.onPublish?.(live, payload);
      try {
        await options.redis.publish(live, payload);
      } catch (error) {
        onError(error);
      }

      // Only line/phase/status are worth replaying; a stale progress percentage
      // would mislead a reconnecting viewer.
      if (!isReplayed(message)) return;
      try {
        await options.redis.rpush(buffer, payload);
        await options.redis.ltrim(buffer, -length, -1);
        await options.redis.expire(buffer, ttl);
      } catch (error) {
        onError(error);
      }
    },
  };
}
