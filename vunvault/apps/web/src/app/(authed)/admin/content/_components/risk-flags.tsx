'use client';

import type { RiskFlag } from '@vunvault/contracts';
import { RISK_FLAG_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';

/**
 * Risk-flag chips (Task 83) — the `Risk Flags` cell.
 *
 * Labels come from the contract's `RISK_FLAG_LABELS`; an item with no flags
 * renders the reference's em dash rather than an empty cell, so the column
 * never looks broken. The tone modifier is per flag, not per severity: legal
 * and PII are the two the prototype colours as blocking.
 */

/** Flag → the reference's chip modifier. */
const FLAG_TONE: Record<RiskFlag, string> = {
  legal_review_required: 'cm-risk--legal',
  contains_pii: 'cm-risk--pii',
  unverified_claim: 'cm-risk--claim',
  brand_sensitive: 'cm-risk--brand',
};

export function RiskFlags({ flags }: { flags: readonly RiskFlag[] }) {
  if (flags.length === 0) return <span className="cm-risk-none">—</span>;

  return (
    <div className="cm-risk-stack">
      {flags.map((flag) => (
        <span key={flag} className={cn('cm-risk', FLAG_TONE[flag])}>
          {RISK_FLAG_LABELS[flag]}
        </span>
      ))}
    </div>
  );
}
