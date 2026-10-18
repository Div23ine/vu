'use client';

import type { ClientProfile } from '@vunvault/contracts';

/**
 * Account stats — the three hero metrics. `engagements` and
 * `openFindings` render zero-padded to two digits (the design's `07`);
 * `nextAssessmentInDays` renders `<n> days` per the behaviour spec (the
 * design's `14d` yields to it), or `—` when null.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export interface AccountStatsProps {
  stats: ClientProfile['stats'];
}

export function AccountStats({ stats }: AccountStatsProps) {
  return (
    <div className="vvp-identity-stats" aria-label="Account summary">
      <div>
        <div className="vvp-stat-label">Engagements</div>
        <div className="vvp-stat-value">{pad2(stats.engagements)}</div>
      </div>
      <div>
        <div className="vvp-stat-label">Open Findings</div>
        <div className="vvp-stat-value">{pad2(stats.openFindings)}</div>
      </div>
      <div>
        <div className="vvp-stat-label">Next Assessment</div>
        <div className="vvp-stat-value">
          {stats.nextAssessmentInDays === null ? '—' : `${stats.nextAssessmentInDays} days`}
        </div>
      </div>
    </div>
  );
}
