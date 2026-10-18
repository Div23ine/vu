import type { Severity } from '../emit.js';

/**
 * httpx adapter (Task 87) — JSONL in, tech/header lines and findings out.
 *
 * httpx emits one JSON object per probed URL. The findings this adapter can
 * honestly claim are the missing-security-header ones, and only on an HTML 200
 * response: a `Content-Security-Policy` absent from a JSON API or a 404 is not a
 * vulnerability, and reporting it as one would train reviewers to ignore the
 * report.
 */

export interface HttpxRecord {
  url: string;
  statusCode: number | null;
  title: string | null;
  technologies: string[];
  headers: Record<string, string>;
  contentType: string | null;
}

export interface HttpxParseResult {
  records: HttpxRecord[];
  lines: string[];
  findings: HttpxFinding[];
}

export interface HttpxFinding {
  severity: Severity;
  title: string;
  description: string;
  cwe?: string;
  remediation: string;
}

/** Headers expected on an HTML response, in report order. */
const EXPECTED_HEADERS: readonly { name: string; title: string; remediation: string }[] = [
  {
    name: 'strict-transport-security',
    title: 'Missing Strict-Transport-Security header',
    remediation:
      'Set `Strict-Transport-Security: max-age=31536000; includeSubDomains` on every HTTPS response.',
  },
  {
    name: 'content-security-policy',
    title: 'Missing Content-Security-Policy header',
    remediation: 'Set a Content-Security-Policy that restricts script, frame and object sources.',
  },
];

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** Parse one JSONL line. A malformed line is skipped, never fatal. */
export function parseHttpxLine(line: string): HttpxRecord | null {
  const trimmed = line.trim();
  if (trimmed === '' || !trimmed.startsWith('{')) return null;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    const rawHeaders = raw.headers;
    if (typeof rawHeaders === 'object' && rawHeaders !== null) {
      for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
        if (typeof value === 'string') headers[key] = value;
      }
    }
    return {
      url: typeof raw.url === 'string' ? raw.url : '',
      statusCode: typeof raw['status-code'] === 'number' ? raw['status-code'] : null,
      title: typeof raw.title === 'string' ? raw.title : null,
      technologies: Array.isArray(raw.tech)
        ? (raw.tech as unknown[]).filter((value): value is string => typeof value === 'string')
        : [],
      headers,
      // httpx reports the content type at the top level; fall back to the
      // header map for builds that only emit it there.
      contentType:
        typeof raw['content-type'] === 'string'
          ? raw['content-type']
          : typeof headers['content-type'] === 'string'
            ? headers['content-type']
            : null,
    };
  } catch {
    return null;
  }
}

function isHtmlResponse(record: HttpxRecord): boolean {
  return record.statusCode === 200 && (record.contentType ?? '').toLowerCase().includes('html');
}

export function parseHttpxOutput(lines: readonly string[]): HttpxParseResult {
  const records: HttpxRecord[] = [];
  const output: string[] = [];
  const findings: HttpxFinding[] = [];

  for (const line of lines) {
    const record = parseHttpxLine(line);
    if (record === null) continue;
    records.push(record);

    const status = record.statusCode === null ? '?' : String(record.statusCode);
    output.push(
      `[*] ${record.url} → ${status}${record.title === null ? '' : ` "${record.title}"`}`,
    );
    if (record.technologies.length > 0) {
      output.push(`[*] ${record.url} technologies: ${record.technologies.join(', ')}`);
    }

    // Only an HTML 200 response is held to the header baseline.
    if (!isHtmlResponse(record)) continue;
    for (const expected of EXPECTED_HEADERS) {
      if (headerValue(record.headers, expected.name) !== undefined) continue;
      // Dedupe per header, not per URL: the same missing header on ten pages is
      // one finding for the report.
      if (findings.some((finding) => finding.title === expected.title)) continue;
      findings.push({
        severity: 'low',
        title: expected.title,
        description: `${record.url} returned an HTML 200 response without a ${expected.name} header.`,
        cwe: expected.name === 'strict-transport-security' ? 'CWE-319' : 'CWE-693',
        remediation: expected.remediation,
      });
    }
  }

  return { records, lines: output, findings };
}
