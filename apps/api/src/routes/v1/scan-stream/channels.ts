/**
 * Scan stream channel naming — the API side of the wire (Task 95).
 *
 * These three strings are IDENTICAL to the ones in
 * `apps/scan-worker/src/domain/output-channel.ts` (Task 88). They live in one
 * module on each side by necessity — the API must not import from an app, and
 * the controller cannot import from `apps/api` — while the PAYLOADS both sides
 * exchange come from `@vunvault/contracts` (`scan-stream.ts`), which is what
 * actually keeps the wire honest. `session.test.ts` pins the literals here,
 * `output-channel`'s suite pins them there.
 *
 *  - `scan:out:<jobId>`  — live Pub/Sub, every `ScanStreamMessage`.
 *  - `scan:buf:<jobId>`  — the replay LIST (RPUSH/LTRIM 2 000/EXPIRE 1 h),
 *    line/phase/status frames only.
 *  - `scan:ctl:<jobId>`  — inbound control; four message types, nothing else.
 */

export const liveChannel = (jobId: string): string => `scan:out:${jobId}`;
export const replayBufferKey = (jobId: string): string => `scan:buf:${jobId}`;
export const controlChannel = (jobId: string): string => `scan:ctl:${jobId}`;
