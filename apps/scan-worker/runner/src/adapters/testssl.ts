import { severityFromLabel } from '../severity';
import type { Severity } from '../emit';

/**
 * testssl.sh adapter (Task 87).
 *
 * testssl writes a pretty-printed JSON array where each element carries an
 * `id`, a `severity` of `INFO|LOW|MEDIUM|HIGH|CRITICAL` and a `finding`. Only
 * MEDIUM and above become findings — the LOW and INFO rows are mostly "this
 * cipher is supported" noise, and a report full of them hides the two lines that
 * matter.
 *
 * Certificate problems, protocol downgrades and weak ciphers all arrive through
 * the same shape, so this adapter does not special-case them: the tool's own
 * severity is mapped through `severityFromLabel`, which degrades anything
 * unrecognised to `info` (and therefore out).
 */

export interface TestsslFinding {
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
}

export interface TestsslParseResult {
  findings: TestsslFinding[];
  lines: string[];
}

/** Severities worth reporting. */
const REPORTED = new Set(['medium', 'high', 'critical']);

const REMEDIATION_BY_ID: Record<string, string> = {
  SSLv2: 'Disable SSLv2 on the endpoint.',
  SSLv3: 'Disable SSLv3 on the endpoint (POODLE).',
  TLS1: 'Disable TLS 1.0; require TLS 1.2 or newer.',
  TLS1_1: 'Disable TLS 1.1; require TLS 1.2 or newer.',
  BEAST: 'Prefer TLS 1.2+ and AEAD cipher suites.',
  LUCKY13: 'Prefer AEAD cipher suites (GCM or ChaCha20-Poly1305).',
  RC4: 'Disable all RC4 cipher suites.',
  DROWN: 'Disable SSLv2 everywhere on this host and its certificates.',
  LOGJAM: 'Disable export-grade Diffie-Hellman and use 2048-bit parameters or ECDHE.',
  SWEET32: 'Disable 3DES and other 64-bit block ciphers.',
  BREACH: 'Disable HTTP compression on responses that reflect user input.',
  POODLE: 'Disable SSLv3 and ensure TLS_FALLBACK_SCSV is supported.',
  SECURE_CLIENT_RENEG: 'Disable client-initiated renegotiation.',
  HSTS: 'Send Strict-Transport-Security with a long max-age on every HTTPS response.',
  certificate_expiration: 'Renew the certificate before it expires.',
  cert_eTLS: 'Restrict the certificate to a single trust purpose.',
};

interface TestsslEntry {
  id: string;
  severity: string;
  finding: string;
}

/** Parse the pretty JSON array. Malformed input yields nothing, never a throw. */
export function parseTestsslJson(raw: string): TestsslParseResult {
  const empty: TestsslParseResult = { findings: [], lines: [] };
  const trimmed = raw.trim();
  if (trimmed === '') return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return empty;
  }

  const entries = (Array.isArray(parsed) ? parsed : []) as unknown[];
  const findings: TestsslFinding[] = [];
  const lines: string[] = [];

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const severity = typeof record.severity === 'string' ? record.severity : '';
    const finding = typeof record.finding === 'string' ? record.finding : '';
    if (id === '' || finding === '') continue;

    const mapped = severityFromLabel(severity);
    if (!REPORTED.has(mapped)) continue;

    findings.push({
      severity: mapped,
      title: `TLS: ${id.replace(/_/g, ' ')}`,
      description: finding,
      remediation:
        REMEDIATION_BY_ID[id] ?? 'Review the TLS configuration against current guidance.',
    });
    lines.push(`[*] TLS ${id}: ${finding}`);
  }

  return { findings, lines };
}

/** A convenience alias so callers can describe an entry uniformly. */
export type { TestsslEntry };
