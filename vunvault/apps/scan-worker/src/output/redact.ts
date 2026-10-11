/**
 * Credential redaction (Task 85).
 *
 * Tool output is UNTRUSTED text that ends up in a browser terminal, a log
 * archive and a client-facing finding. A scan frequently prints exactly the
 * things that must never leave the pod — an `Authorization` header it echoed, a
 * JWT from a response body, a key a target leaked in an error page. This module
 * is the filter.
 *
 * Two entry points, because two shapes of secret exist:
 *  - `redact(text)` is stateless and handles anything that fits on one line.
 *  - `Redactor` is stateful and additionally covers a PEM private-key block,
 *    which spans lines and would otherwise leak its body between the BEGIN and
 *    END markers.
 *
 * `REDACTION_PATTERNS` is exported as DATA so the server-side redactor
 * (Task 40g) and these tests share one list conceptually. It is deliberately a
 * copy, not an import: the worker must not pull API internals into the scan
 * cluster, and the two run in different trust zones.
 *
 * Deliberate NON-goals, per the spec: email addresses are NOT redacted (they
 * are legitimate finding evidence), and nothing outside this table is touched.
 * Over-redaction destroys the evidence a report is worth.
 */

export const REDACTED = '[REDACTED]';

export interface RedactionPattern {
  id: string;
  re: RegExp;
  /** A string replacement; `$1`-style groups keep the key name. */
  replace: string;
}

/**
 * The table, in application order.
 *
 * Order matters: specific token shapes run BEFORE the generic `key=value` rule,
 * so a JWT is replaced as a JWT rather than having only half of it caught by the
 * keyword rule and leaving a recognisable fragment behind.
 */
export const REDACTION_PATTERNS: readonly RedactionPattern[] = [
  {
    id: 'authorization-header',
    re: /(\bauthorization\s*:\s*(?:bearer|basic|token)\s+)\S+/gi,
    replace: `$1${REDACTED}`,
  },
  {
    id: 'cookie-header',
    re: /(\b(?:set-)?cookie\s*:\s*)\S[^\n]*/gi,
    replace: `$1${REDACTED}`,
  },
  {
    id: 'jwt',
    re: /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}\b/g,
    replace: REDACTED,
  },
  {
    id: 'aws-access-key',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replace: REDACTED,
  },
  {
    id: 'aws-secret-key',
    re: /(aws_secret_access_key\s*[:=]\s*)[A-Za-z0-9/+=]{40}/gi,
    replace: `$1${REDACTED}`,
  },
  {
    id: 'github-token',
    re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
    replace: REDACTED,
  },
  {
    id: 'slack-token',
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    replace: REDACTED,
  },
  {
    id: 'google-api-key',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    replace: REDACTED,
  },
  {
    id: 'stripe-key',
    re: /\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    replace: REDACTED,
  },
  {
    id: 'url-credentials',
    // `://user:pass@host` → `://[REDACTED]@host`; the host stays, it is the target.
    re: /(:\/\/)[^\s/@:]+:[^\s/@]+@/g,
    replace: `$1${REDACTED}@`,
  },
  {
    id: 'pem-private-key-marker',
    // Stateless pass: the markers themselves never survive, even when the body
    // is handled line-by-line by `Redactor`.
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----|-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: REDACTED,
  },
  {
    id: 'keyword-value',
    re: /\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth|session|credential)s?(\s*[:=]\s*)\S+/gi,
    replace: `$1$2${REDACTED}`,
  },
  {
    id: 'keyword-adjacent-blob',
    // A long hex (≥32) or base64 (≥40) run near one of those keywords.
    re: /\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth|session|credential)s?\b([^\n]{0,40}?)([A-Fa-f0-9]{32,}|[A-Za-z0-9+/=_-]{40,})/gi,
    replace: `$1$2${REDACTED}`,
  },
] as const;

/** Apply the whole table to one string. Stateless and idempotent. */
export function redact(text: string): string {
  let output = text;
  for (const pattern of REDACTION_PATTERNS) {
    // A global regex carries `lastIndex`; reset so reuse across calls is safe.
    pattern.re.lastIndex = 0;
    output = output.replace(pattern.re, pattern.replace);
  }
  return output;
}

const PEM_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PEM_END = /-----END [A-Z ]*PRIVATE KEY-----/;

/**
 * Line-oriented redactor with PEM block memory.
 *
 * Once a `BEGIN … PRIVATE KEY` line is seen, EVERY subsequent line is replaced
 * until the matching `END` — including the markers. A key body is base64 with no
 * keyword on it, so a stateless pass would let it through untouched; this is why
 * the streaming pipeline uses `push` rather than `redact`.
 */
export class Redactor {
  private insidePem = false;

  /** True while a private-key block is open (exposed for tests and metrics). */
  get inPrivateKeyBlock(): boolean {
    return this.insidePem;
  }

  push(line: string): string {
    if (this.insidePem) {
      if (PEM_END.test(line)) this.insidePem = false;
      return REDACTED;
    }
    if (PEM_BEGIN.test(line)) {
      // A one-line key (BEGIN and END together) closes immediately.
      this.insidePem = !PEM_END.test(line);
      return REDACTED;
    }
    return redact(line);
  }

  reset(): void {
    this.insidePem = false;
  }
}
