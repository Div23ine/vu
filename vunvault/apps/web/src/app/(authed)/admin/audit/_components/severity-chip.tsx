'use client';

import type { AuditSeverity } from '@vunvault/contracts';
import { AUDIT_SEVERITY_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';

/**
 * Audit severity chip (Task 83b).
 *
 * Colours follow the spec exactly — `ok` green, `info` blue, `warning` amber,
 * `critical` red — and the label comes from the contract's
 * `AUDIT_SEVERITY_LABELS`. When the entry carries a `sevLevel` the chip gains
 * the `SEV-n` suffix, which is how a SEV-1 broadcast event reads in the trail.
 */

const SEVERITY_TONE: Record<AuditSeverity, string> = {
  ok: 'al-sev--ok',
  info: 'al-sev--info',
  warning: 'al-sev--warning',
  critical: 'al-sev--critical',
};

export interface SeverityChipProps {
  severity: AuditSeverity;
  /** `1`–`3`, or null when the entry carries no incident level. */
  sevLevel: number | null;
  className?: string;
}

export function SeverityChip({ severity, sevLevel, className }: SeverityChipProps) {
  return (
    <span className={cn('al-sev', SEVERITY_TONE[severity], className)}>
      {AUDIT_SEVERITY_LABELS[severity]}
      {sevLevel === null ? null : <span className="al-sev-level">{`SEV-${sevLevel}`}</span>}
    </span>
  );
}
