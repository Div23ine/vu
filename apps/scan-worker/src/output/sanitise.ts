import { redact } from './redact.js';

/**
 * Line sanitiser (Task 85).
 *
 * Raw pod stdout reaches a browser terminal, so it is treated as hostile until
 * proven otherwise. In order:
 *
 *  1. **ANSI is stripped** — CSI, OSC and any other `\x1b`-initiated sequence up
 *     to 8 bytes. A terminal escape is how a scan of an untrusted target could
 *     otherwise rewrite what an operator sees, retitle their window, or (with an
 *     OSC 52 clipboard sequence) write to their clipboard.
 *  2. **`\r` progress rewrites collapse** to their last segment, so a spinner
 *     does not become a wall of concatenated frames.
 *  3. **Control characters go**, except `\t`: NUL, backspace, DEL and the C1
 *     range (`\x80–\x9f`) are all ways to smuggle content past a naive filter.
 *  4. A **whitespace-only line returns `null`** — dropped, not rendered blank.
 *  5. **Credentials are redacted.**
 *  6. The result is **capped at 8192 bytes**, cut on a code-point boundary and
 *     suffixed `…[truncated]`.
 *  7. **Trailing whitespace is trimmed.**
 *
 * The function is idempotent: `sanitiseLine(sanitiseLine(x)) === sanitiseLine(x)`.
 * That matters because a line can be sanitised once for the terminal and again
 * before it is archived, and a second pass must not alter the first result.
 */

/** Hard cap on one sanitised line, in UTF-8 bytes. */
export const MAX_LINE_BYTES = 8_192;

export const TRUNCATION_SUFFIX = '…[truncated]';

/** CSI: `ESC [ params intermediates final`. */
/* eslint-disable no-control-regex -- matching control characters IS this
   module's job: these four patterns are how a terminal escape, an OSC clipboard
   write and a NUL/DEL/C1 smuggled out of a scanned target are removed before
   the line reaches an operator's terminal. */
const ANSI_CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;

/** OSC: `ESC ] … (BEL | ESC \)`. */
const ANSI_OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

/** Any other escape-initiated run, bounded so a truncated stream cannot hang. */
const ANSI_OTHER = /\x1b.{0,8}/gs;

/** C0 controls except `\t`, plus DEL and the C1 range. */
const CONTROL_CHARS = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

/**
 * Strip terminal escapes.
 *
 * CSI and OSC are matched first because they are the long, structured forms;
 * the bounded fallback then catches anything else an escape introduced, so no
 * `\x1b` can survive into the terminal.
 */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_CSI, '').replace(ANSI_OSC, '').replace(ANSI_OTHER, '');
}

/**
 * Collapse `\r` rewrites: keep the last non-empty segment.
 *
 * A progress bar emits `10%\r25%\r50%…`; the operator should see the final
 * frame, not the whole history glued together.
 */
export function collapseCarriageReturns(input: string): string {
  if (!input.includes('\r')) return input;
  const segments = input.split('\r');
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment !== undefined && segment.trim() !== '') return segment;
  }
  return '';
}

/**
 * Cut to at most `maxBytes` of UTF-8 WITHOUT splitting a code point, then append
 * the suffix.
 *
 * Iterating with `for…of` walks code points, not UTF-16 units, so an astral
 * character (an emoji) is never cut in half — a split surrogate pair would
 * produce invalid UTF-8 and a replacement character in the terminal.
 */
export function capBytes(input: string, maxBytes: number): string {
  if (byteLength(input) <= maxBytes) return input;

  const suffixBytes = byteLength(TRUNCATION_SUFFIX);
  const budget = Math.max(0, maxBytes - suffixBytes);

  let used = 0;
  let cut = '';
  for (const codePoint of input) {
    const width = byteLength(codePoint);
    if (used + width > budget) break;
    cut += codePoint;
    used += width;
  }
  return `${cut}${TRUNCATION_SUFFIX}`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Sanitise one line. Returns `null` when the line should be dropped entirely
 * (nothing but whitespace once escapes and controls are gone).
 */
export function sanitiseLine(raw: string): string | null {
  const withoutAnsi = stripAnsi(raw);
  const collapsed = collapseCarriageReturns(withoutAnsi);
  const withoutControls = collapsed.replace(CONTROL_CHARS, '');

  if (withoutControls.trim() === '') return null;

  const redacted = redact(withoutControls);
  const capped = capBytes(redacted, MAX_LINE_BYTES);
  const trimmed = capped.replace(/\s+$/, '');

  return trimmed === '' ? null : trimmed;
}
