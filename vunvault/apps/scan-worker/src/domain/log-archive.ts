/**
 * Log archive (Task 88).
 *
 * Accumulates the SAME sanitised text that was streamed, so the archived log and
 * the live terminal can never disagree — one string, two destinations.
 *
 * The 5 MB cap is the contract's `INTERNAL_LOG_MAX_BYTES`, and hitting it does
 * not stop counting: `lineCount` and `bytesStreamed` keep growing so the
 * completion report describes the scan accurately even though the archive was
 * truncated. A truncated archive is a smaller report; a wrong line count is a
 * lie.
 *
 * Everything is in memory. The pod's filesystem is read-only apart from a tmpfs,
 * and the controller has no durable storage of its own — the archive exists only
 * long enough to be PUT to the presigned URL the API mints.
 */

import { INTERNAL_LOG_MAX_BYTES } from '@vunvault/contracts';

export const LOG_MAX_BYTES = INTERNAL_LOG_MAX_BYTES;

export interface LogArchiveSnapshot {
  /** The archived text, capped at `LOG_MAX_BYTES`. */
  text: string;
  bytes: number;
  /** Every line seen, including those dropped by the cap. */
  lineCount: number;
  /** Every byte seen, including those dropped by the cap. */
  bytesStreamed: number;
  truncated: boolean;
}

export class LogArchive {
  private readonly chunks: string[] = [];
  private readonly maxBytes: number;
  private bufferedBytes = 0;
  private lineCount = 0;
  private bytesStreamed = 0;
  private truncated = false;

  constructor(maxBytes: number = LOG_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  /** Append one already-sanitised line. */
  append(line: string): void {
    this.lineCount += 1;
    // +1 for the newline that joins the archive.
    const size = Buffer.byteLength(line, 'utf8') + 1;
    this.bytesStreamed += size;

    if (this.truncated) return;
    if (this.bufferedBytes + size > this.maxBytes) {
      // Stop storing, keep counting.
      this.truncated = true;
      return;
    }
    this.chunks.push(line);
    this.bufferedBytes += size;
  }

  get isTruncated(): boolean {
    return this.truncated;
  }

  get lines(): number {
    return this.lineCount;
  }

  get bytes(): number {
    return this.bytesStreamed;
  }

  /** The archived text, joined exactly as the API expects to store it. */
  render(): string {
    return this.chunks.join('\n');
  }

  snapshot(): LogArchiveSnapshot {
    return {
      text: this.render(),
      bytes: this.bufferedBytes,
      lineCount: this.lineCount,
      bytesStreamed: this.bytesStreamed,
      truncated: this.truncated,
    };
  }

  reset(): void {
    this.chunks.length = 0;
    this.bufferedBytes = 0;
    this.lineCount = 0;
    this.bytesStreamed = 0;
    this.truncated = false;
  }
}

/**
 * Upload the archive to a presigned URL.
 *
 * A raw `fetch`, not the signed API client: the URL is pre-authorised, carries no
 * session, and must not be signed again. Failure is NOT fatal — the caller logs
 * it and completes the job without a `redactedLogKey`, because losing the
 * archive must not lose the findings.
 */
export async function uploadLog(
  uploadUrl: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: text,
    });
    return response.ok;
  } catch {
    return false;
  }
}
