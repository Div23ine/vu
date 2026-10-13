'use client';

import { useClientProfile } from '../profile/_hooks/use-client-profile';
import { useScans } from '../_hooks/use-scans';
import '../_styles/scans.css';

/**
 * Summary cards (Task 69) — `Reports released` (the list's total — the API
 * counts only released jobs), `Open findings` (the profile stat, highlighted
 * in the critical colour when non-zero: the planner's "critical+high
 * highlighted" with no client-side severity breakdown available) and
 * `Next assessment` (`<n> days` from the profile stats, `—` when null).
 */

export function ScanSummaryCards() {
  const scans = useScans({ page: 1, pageSize: 10 });
  const profile = useClientProfile();

  const released = scans.data?.total;
  const openFindings = profile.data?.stats.openFindings;
  const nextAssessment = profile.data?.stats.nextAssessmentInDays;

  return (
    <div className="vps-summary-row">
      <div className="vps-summary-card">
        <div className="vps-summary-label">Reports released</div>
        <div className="vps-summary-value">{released === undefined ? '—' : released}</div>
      </div>
      <div className="vps-summary-card">
        <div className="vps-summary-label">Open findings</div>
        <div
          className={
            openFindings !== undefined && openFindings > 0
              ? 'vps-summary-value vps-summary-value--alert'
              : 'vps-summary-value'
          }
        >
          {openFindings === undefined ? '—' : openFindings}
        </div>
      </div>
      <div className="vps-summary-card">
        <div className="vps-summary-label">Next assessment</div>
        <div className="vps-summary-value">
          {nextAssessment === undefined || nextAssessment === null ? '—' : `${nextAssessment} days`}
        </div>
      </div>
    </div>
  );
}
