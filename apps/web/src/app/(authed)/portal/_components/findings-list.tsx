'use client';

import type { ScanFinding } from '@vunvault/contracts';
import { SEVERITY_PRIORITY } from '@vunvault/contracts';
import { Badge, type BadgeTone } from '@vunvault/ui';
import '../_styles/scans.css';

/**
 * Findings list (Task 69) — the released report's findings, sorted
 * critical → low (`SEVERITY_PRIORITY`), each a collapsible `<details>`:
 * title + severity `Badge` + CVSS/CWE when present, description, the
 * `Remediation` text and the redacted evidence in a monospace block.
 *
 * Evidence safety: it renders as a React TEXT node inside `<pre>` — a stored
 * `<img onerror=…>` string stays inert markup, never DOM. The contract's
 * `ScanFinding` view does not carry the evidence column yet; the wire field
 * is read when present and the section stays hidden otherwise.
 * TODO(backend-contract): add `evidenceRedacted` to `ScanFinding` (Task 19
 * contract) so the API serializer stops stripping the column.
 */

interface FindingWithEvidence extends ScanFinding {
  evidenceRedacted?: string | null;
}

const SEVERITY_TONES: Record<ScanFinding['severity'], BadgeTone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const SEVERITY_LABELS: Record<ScanFinding['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function FindingsList({ findings }: { findings: ScanFinding[] }) {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity],
  );
  return (
    <div className="vps-findings">
      {sorted.map((finding) => {
        const evidence = (finding as FindingWithEvidence).evidenceRedacted;
        return (
          <details key={finding.id} className="vps-finding">
            <summary className="vps-finding-summary">
              <Badge tone={SEVERITY_TONES[finding.severity]}>
                {SEVERITY_LABELS[finding.severity]}
              </Badge>
              <span className="vps-finding-title">{finding.title}</span>
              <span className="vps-finding-meta">
                {finding.cvss !== null ? <span>CVSS {finding.cvss.toFixed(1)}</span> : null}
                {finding.cwe !== null ? <span>{finding.cwe}</span> : null}
              </span>
            </summary>
            <div className="vps-finding-body">
              <p className="vps-finding-desc">{finding.description}</p>
              {finding.remediationGuidance !== null ? (
                <>
                  <div className="vps-finding-block-label">Remediation</div>
                  <p className="vps-finding-remediation">{finding.remediationGuidance}</p>
                </>
              ) : null}
              {typeof evidence === 'string' && evidence !== '' ? (
                <>
                  <div className="vps-finding-block-label">Evidence (redacted)</div>
                  {/* Text node only — stored markup must never execute. */}
                  <pre className="vps-finding-evidence">{evidence}</pre>
                </>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
