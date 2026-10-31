'use client';

import { Lock } from 'lucide-react';
import type { ReviewDecision } from '@vunvault/contracts';
import { GATE_DECISION_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../_styles/scan-queue.css';

/**
 * Gate decision picker — the three decision radio cards
 * (`GATE_DECISION_LABELS` titles/descriptions verbatim). Without
 * `scans:release` the `Approve & Release` card is disabled and carries the
 * verbatim tooltip `Requires administrator authority.`
 */

const DECISIONS = Object.keys(GATE_DECISION_LABELS) as ReviewDecision[];

interface GateDecisionPickerProps {
  decision: ReviewDecision | null;
  canRelease: boolean;
  onChange(decision: ReviewDecision): void;
}

export function GateDecisionPicker({ decision, canRelease, onChange }: GateDecisionPickerProps) {
  return (
    <div>
      <div className="sq-modal-section-title">Gate Decision</div>
      <div className="sq-decisions" role="radiogroup" aria-label="Gate Decision">
        {DECISIONS.map((key) => {
          const locked = key === 'approve_release' && !canRelease;
          return (
            <label
              key={key}
              className={cn(
                'sq-decision',
                decision === key ? 'is-selected' : undefined,
                locked ? 'is-disabled' : undefined,
              )}
              title={locked ? 'Requires administrator authority.' : undefined}
            >
              <input
                type="radio"
                name="sq-gate-decision"
                value={key}
                className="sq-decision-input"
                checked={decision === key}
                disabled={locked}
                onChange={() => onChange(key)}
              />
              <span className="sq-decision-title">
                {GATE_DECISION_LABELS[key].title}
                {locked ? (
                  <span className="sq-decision-lock">
                    <Lock size={12} aria-hidden="true" />
                    Requires administrator authority.
                  </span>
                ) : null}
              </span>
              <span className="sq-decision-desc">{GATE_DECISION_LABELS[key].description}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
