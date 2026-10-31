'use client';

import '../_styles/scans.css';

/**
 * Compact severity bar — the Findings-column widget: a proportional
 * four-segment bar (critical → low, token colours) plus the non-zero counts.
 * Zero findings render the muted `No findings` line.
 */

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function totalOf(counts: SeverityCounts): number {
  return counts.critical + counts.high + counts.medium + counts.low;
}

const ORDER = ['critical', 'high', 'medium', 'low'] as const;
const LETTERS: Record<(typeof ORDER)[number], string> = {
  critical: 'C',
  high: 'H',
  medium: 'M',
  low: 'L',
};

export function SeverityBar({ counts }: { counts: SeverityCounts }) {
  const total = totalOf(counts);
  if (total === 0) {
    return <span className="vps-severity-empty">No findings</span>;
  }
  return (
    <span
      className="vps-severity"
      role="img"
      aria-label={`${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`}
    >
      <span className="vps-severity-bar" aria-hidden="true">
        {ORDER.map((severity) =>
          counts[severity] > 0 ? (
            <span
              key={severity}
              className={`vps-severity-seg vps-severity-seg--${severity}`}
              style={{ width: `${(counts[severity] / total) * 100}%` }}
            />
          ) : null,
        )}
      </span>
      <span className="vps-severity-counts" aria-hidden="true">
        {ORDER.filter((severity) => counts[severity] > 0)
          .map((severity) => `${counts[severity]}${LETTERS[severity]}`)
          .join(' · ')}
      </span>
    </span>
  );
}
