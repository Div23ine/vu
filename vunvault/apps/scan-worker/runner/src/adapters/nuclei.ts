import { normaliseCwe, parseCvss, severityOf } from '../severity';
import type { Severity } from '../emit';

/**
 * nuclei adapter (Task 87) — JSONL in, findings out.
 *
 * nuclei already grades its templates, so this adapter mostly transcribes:
 * `info.severity` becomes our severity, and when a template carries a CVSS score
 * the score can only RAISE the grade (`severityOf`), never lower it — a template
 * labelled `medium` that documents a CVSS 9.8 is a critical.
 *
 * Evidence is deliberately thin. `extracted-results` and `curl-command` are
 * omitted: they frequently contain session cookies, tokens or full request bodies
 * from the target, and the controller redacts what it receives but cannot
 * un-see it. `matched-at` is kept because a URL carries no credential.
 */

export interface NucleiFinding {
  severity: Severity;
  title: string;
  description: string;
  cvss?: number;
  cwe?: string;
  remediation?: string;
  matchedAt?: string;
}

export interface NucleiParseResult {
  findings: NucleiFinding[];
  lines: string[];
  /** Templates that reported `info` — counted, not forwarded. */
  infoCount: number;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Parse one nuclei JSONL line. Anything unrecognisable is skipped. */
export function parseNucleiLine(line: string): NucleiFinding | null {
  const trimmed = line.trim();
  if (trimmed === '' || !trimmed.startsWith('{')) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }

  const info = (typeof raw.info === 'object' && raw.info !== null ? raw.info : {}) as Record<
    string,
    unknown
  >;
  const classification = (typeof info.classification === 'object' && info.classification !== null
    ? info.classification
    : {}) as Record<string, unknown>;

  const title = stringValue(info.name) ?? stringValue(raw['template-id']) ?? 'nuclei finding';
  const description =
    stringValue(info.description) ?? `nuclei template ${stringValue(raw['template-id']) ?? ''} matched.`;

  const rawSeverity = stringValue(info.severity);
  if (rawSeverity === undefined) return null;

  // `cwe-id` arrives as a string or an array; take the first well-formed one.
  const cweCandidates = Array.isArray(classification['cwe-id'])
    ? (classification['cwe-id'] as unknown[])
    : [classification['cwe-id']];
  const cwe = cweCandidates
    .map((candidate) => normaliseCwe(candidate))
    .find((candidate) => candidate !== undefined);

  const cvss = parseCvss(classification['cvss-score']);
  const severity = severityOf(rawSeverity, cvss);

  const finding: NucleiFinding = { severity, title, description };
  if (cvss !== null) finding.cvss = cvss;
  if (cwe !== undefined) finding.cwe = cwe;
  const remediation = stringValue(info.remediation);
  if (remediation !== undefined) finding.remediation = remediation;
  const matchedAt = stringValue(raw['matched-at']) ?? stringValue(raw.host);
  if (matchedAt !== undefined) finding.matchedAt = matchedAt;

  return finding;
}

export function parseNucleiOutput(lines: readonly string[]): NucleiParseResult {
  const findings: NucleiFinding[] = [];
  const output: string[] = [];
  let infoCount = 0;

  for (const line of lines) {
    const finding = parseNucleiLine(line);
    if (finding === null) continue;
    if (finding.severity === 'info') {
      // `info` has no contract severity; counted so the transcript can say so.
      infoCount += 1;
      continue;
    }
    findings.push(finding);
    const where = finding.matchedAt === undefined ? '' : ` at ${finding.matchedAt}`;
    output.push(`[*] ${finding.title} (${finding.severity})${where}`);
  }

  if (infoCount > 0) {
    output.push(`[~] ${infoCount} informational template match(es) were not reported as findings.`);
  }

  return { findings, lines: output, infoCount };
}
