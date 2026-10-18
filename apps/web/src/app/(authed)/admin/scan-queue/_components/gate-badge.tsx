import type { ReviewGateState } from '@vunvault/contracts';
import { REVIEW_GATE_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../_styles/scan-queue.css';

/**
 * Review-gate badge — the chip text comes from
 * `REVIEW_GATE_LABELS`, with the release-lock line under it: a released job
 * reads `Client access granted`, every locked state reads `Client release
 * blocked` (both verbatim from the reference rows).
 */

const TONE_CLASS: Record<ReviewGateState, string> = {
  in_review: 'sq-gate-badge--awaiting',
  approved_released: 'sq-gate-badge--released',
  held_blocked: 'sq-gate-badge--held',
  blocked_payment: 'sq-gate-badge--payment',
  not_eligible: 'sq-gate-badge--ineligible',
};

export function GateBadge({ state }: { state: ReviewGateState }) {
  const released = state === 'approved_released';
  return (
    <span className="sq-gate">
      <span className={cn('sq-gate-badge', TONE_CLASS[state])}>{REVIEW_GATE_LABELS[state]}</span>
      <span
        className={cn('sq-gate-lock', released ? 'sq-gate-lock--open' : 'sq-gate-lock--locked')}
      >
        {released ? 'Client access granted' : 'Client release blocked'}
      </span>
    </span>
  );
}
