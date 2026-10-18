import { z } from 'zod';
import { BROADCAST_KINDS, BROADCAST_STATUSES } from '@vunvault/db/enum-values';
import { BroadcastRecord } from './intel.js';

/**
 * Broadcast delivery progress contract (Task 89).
 *
 * The broadcast worker publishes one `BroadcastProgressEvent` per delivery
 * milestone to the Redis Pub/Sub channel `broadcast:progress:<broadcastId>`;
 * the API's SSE relay (Task 94) forwards those frames to the Zero-Day desk so
 * an operator watching a SEV-1 go out sees real counters, not a spinner.
 *
 * The event mirrors the columns of `advisory_broadcasts`: `audience` is what
 * the estimate promised, `sent` is what has actually gone out, and `failed`
 * counts per-contact delivery errors. The schema is `.strict()` — the relay
 * forwards nothing it has not parsed, so a malformed frame is dropped at the
 * boundary instead of reaching a browser.
 *
 * Counter semantics (the worker and this schema must agree):
 *  - `sent.dashboards` counts ORGANISATIONS whose in-app notifications all
 *    enqueued cleanly, so it converges on `audience.dashboards`;
 *  - `sent.email` / `sent.sms` count individual contacts;
 *  - a contact that fails on every channel increments `failed` once per
 *    failed delivery attempt, so `failed` can exceed the audience when both
 *    e-mail and SMS fail for the same person. That is deliberate: the number
 *    answers "how many deliveries failed", not "how many people are unhappy".
 */

export const BroadcastCounters = z
  .object({
    dashboards: z.number().int().nonnegative(),
    email: z.number().int().nonnegative(),
    sms: z.number().int().nonnegative(),
  })
  .strict();
export type BroadcastCounters = z.infer<typeof BroadcastCounters>;

export const BroadcastProgressEvent = z
  .object({
    type: z.literal('progress'),
    broadcastId: z.string().uuid(),
    advisoryId: z.string().uuid(),
    kind: z.enum(BROADCAST_KINDS),
    status: z.enum(BROADCAST_STATUSES),
    /** What the pre-broadcast estimate promised. */
    audience: BroadcastCounters,
    /** What has actually gone out so far. */
    sent: BroadcastCounters,
    failed: z.number().int().nonnegative(),
    /** ISO-8601; monotonically non-decreasing per broadcast. */
    updatedAt: z.string().datetime(),
  })
  .strict();
export type BroadcastProgressEvent = z.infer<typeof BroadcastProgressEvent>;

/** Redis Pub/Sub channel carrying a broadcast's progress frames. */
export function broadcastProgressChannel(broadcastId: string): string {
  return `broadcast:progress:${broadcastId}`;
}

/**
 * The SSE relay's wire format (Task 94).
 *
 * `GET /api/v1/admin/advisories/:id/broadcasts/stream` sends exactly these
 * frames: one `snapshot` on connect (the current `BroadcastRecord[]`, so a desk
 * that opens mid-flight is immediately correct), then the worker's `progress`
 * events filtered to this advisory, with `heartbeat` frames keeping the pipe
 * warm. Like the audit stream's `AuditStreamEvent`, the union is what BOTH
 * sides parse — the relay forwards nothing it has not validated, and the desk
 * renders nothing it has not validated.
 */
export const BroadcastStreamEvent = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('snapshot'),
      records: z.array(BroadcastRecord),
    })
    .strict(),
  BroadcastProgressEvent,
  z
    .object({
      type: z.literal('heartbeat'),
    })
    .strict(),
]);
export type BroadcastStreamEvent = z.infer<typeof BroadcastStreamEvent>;
