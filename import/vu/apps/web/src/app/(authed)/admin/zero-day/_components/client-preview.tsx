'use client';

import type { AdvisoryScopeEntry, FindingSeverity } from '@vunvault/contracts';
import { SCOPE_CATEGORY_LABELS } from '@vunvault/contracts';
import { cn, formatLongDate } from '@vunvault/lib';

/**
 * Client-dashboard preview — a live rendering of how the advisory
 * in the editor will appear to clients, so an analyst never broadcasts copy
 * they have not read as a client would.
 *
 * The projection mirrors an earlier iteration's `ClientAdvisory` card exactly: the same
 * uppercase severity labels, the same `label · category` scope format and the
 * same fixed `Source: VUNVAULT Intelligence` line (`ClientAdvisory.source` is
 * a `z.literal`, so it is product copy, not data). Empty fields fall back to
 * the design's own placeholders — `CVE-XXXX-XXXXX`, `No severity`,
 * `Advisory title will appear here`, `No scope entries`, `Not dated` — and the
 * title keeps its `is-placeholder` styling until something is typed.
 */

/** an earlier iteration's card labels — uppercase, unlike the desk's own title-case pills. */
const CLIENT_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

export interface ClientPreviewProps {
  cveId: string;
  title: string;
  severity: FindingSeverity | '';
  scope: readonly AdvisoryScopeEntry[];
  /** `YYYY-MM-DD` from the date input, or `''` when unset. */
  disclosureDate: string;
}

function scopeChipText(entry: AdvisoryScopeEntry): string {
  return entry.category === null
    ? entry.label
    : `${SCOPE_CATEGORY_LABELS[entry.category]} · ${entry.label}`;
}

export function ClientPreview({
  cveId,
  title,
  severity,
  scope,
  disclosureDate,
}: ClientPreviewProps) {
  const trimmedCve = cveId.trim();
  const trimmedTitle = title.trim();

  return (
    <div className="zd-preview">
      <div className="zd-preview-top">
        <span className="zd-preview-cve" id="zd-prev-cve">
          {trimmedCve === '' ? 'CVE-XXXX-XXXXX' : trimmedCve}
        </span>
        <span
          className={cn(
            'zd-preview-sev',
            severity === '' ? 'zd-preview-sev--none' : `zd-preview-sev--${severity}`,
          )}
          id="zd-prev-sev"
        >
          {severity === '' ? 'No severity' : CLIENT_SEVERITY_LABELS[severity]}
        </span>
      </div>

      <span
        className={cn('zd-preview-title', trimmedTitle === '' ? 'is-placeholder' : undefined)}
        id="zd-prev-title"
      >
        {trimmedTitle === '' ? 'Advisory title will appear here' : trimmedTitle}
      </span>

      <div className="zd-preview-scope" id="zd-prev-scope">
        {scope.length === 0 ? (
          <span className="zd-preview-chip">No scope entries</span>
        ) : (
          scope.map((entry) => (
            <span key={`${entry.label}:${entry.category ?? 'none'}`} className="zd-preview-chip">
              {scopeChipText(entry)}
            </span>
          ))
        )}
      </div>

      <div className="zd-preview-foot">
        <span>Source: VUNVAULT Intelligence</span>
        <span id="zd-prev-date">
          {disclosureDate === '' ? 'Not dated' : formatLongDate(new Date(disclosureDate))}
        </span>
      </div>
    </div>
  );
}
