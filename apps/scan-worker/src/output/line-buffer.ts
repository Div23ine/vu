/**
 * Line buffer (Task 85) — turns a byte stream into lines.
 *
 * A pod's stdout arrives in arbitrary chunks that split lines (and multi-byte
 * characters) anywhere, so the buffer keeps a partial tail between calls.
 *
 * The tail has a HARD CAP, and that cap is a security control rather than a
 * convenience: a target that emits an endless line with no newline — a
 * progress bar, a hexdump, a compression bomb of a banner — would otherwise grow
 * the buffer without bound and take the controller down with it. At
 * `MAX_TAIL_BYTES` the tail is flushed as a line and the buffer restarts, so the
 * worst case is one oversized line, which `sanitiseLine` then caps at 8 KiB.
 *
 * Decoding is UTF-8 with a replacement character for bad bytes. A split
 * multi-byte sequence at a chunk boundary is handled by keeping the incomplete
 * trailing BYTES (not characters) until the next chunk completes them.
 */

/** A tail longer than this is flushed rather than held. */
export const MAX_TAIL_BYTES = 64 * 1024;

export class LineBuffer {
  private pending: Buffer = Buffer.alloc(0);
  private readonly maxTailBytes: number;
  /** Lines flushed early because the tail cap was hit — a metric worth seeing. */
  private forcedFlushes = 0;

  constructor(maxTailBytes: number = MAX_TAIL_BYTES) {
    this.maxTailBytes = maxTailBytes;
  }

  get overflowFlushes(): number {
    return this.forcedFlushes;
  }

  /** Bytes currently held that have not formed a line yet. */
  get bufferedBytes(): number {
    return this.pending.byteLength;
  }

  /**
   * Feed a chunk, get back every complete line it produced.
   *
   * The returned strings carry no trailing `\n`.
   */
  push(chunk: Buffer): string[] {
    this.pending = this.pending.byteLength === 0 ? chunk : Buffer.concat([this.pending, chunk]);

    const lines: string[] = [];
    let searchFrom = 0;

    for (;;) {
      const newline = this.pending.indexOf(0x0a, searchFrom);
      if (newline === -1) break;
      lines.push(this.decode(this.pending.subarray(0, newline)));
      this.pending = this.pending.subarray(newline + 1);
      searchFrom = 0;
    }

    // No newline in sight and the tail is already too long: flush it so a
    // newline-free stream cannot grow the buffer without bound.
    if (this.pending.byteLength >= this.maxTailBytes) {
      this.forcedFlushes += 1;
      lines.push(this.decode(this.pending));
      this.pending = Buffer.alloc(0);
    }

    return lines;
  }

  /**
   * Flush whatever is left at end-of-stream.
   *
   * A final line without a trailing newline is still a line — most tools omit
   * it on the last write.
   */
  end(): string[] {
    if (this.pending.byteLength === 0) return [];
    const line = this.decode(this.pending);
    this.pending = Buffer.alloc(0);
    return line === '' ? [] : [line];
  }

  /**
   * Decode without splitting a multi-byte character.
   *
   * `TextDecoder` with `stream: true` holds back an incomplete trailing
   * sequence; since we only decode complete lines here (the tail is flushed as
   * raw bytes), a stray incomplete sequence becomes the replacement character
   * rather than throwing — the caller decided the stream was over.
   */
  private decode(bytes: Buffer): string {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}
