'use client';

import { ListChecks } from 'lucide-react';
import { REVIEW_CHECK_LABELS } from '@vunvault/contracts';
import type { GateChecks } from '@vunvault/contracts';
import '../_styles/scan-queue.css';

/**
 * Mandatory verification checklist (Task 78) — the five contract checks,
 * titles + descriptions verbatim from `REVIEW_CHECK_LABELS`, in the
 * contract's display order.
 *
 * The items are written out statically (the payment-channel-picker
 * precedent): `jsx-a11y/label-has-associated-control` verifies a label's
 * accessible text statically, which dynamic `{expression}` children defeat.
 * `review-gate.test.tsx` asserts these literals against the contract map so
 * they cannot drift. The key ORDER for the dialog's counting logic comes
 * from the contract record itself — apps/web has no direct `@vunvault/db`
 * dependency for `REVIEW_CHECK_KEYS`.
 */

export type ReviewCheckKey = keyof GateChecks;

export const REVIEW_CHECKS = Object.keys(REVIEW_CHECK_LABELS) as ReviewCheckKey[];

interface GateChecklistProps {
  checks: GateChecks;
  disabled?: boolean;
  onToggle(key: ReviewCheckKey): void;
}

export function GateChecklist({ checks, disabled = false, onToggle }: GateChecklistProps) {
  return (
    <div>
      <div className="sq-modal-section-title">
        <ListChecks size={13} aria-hidden="true" />
        Mandatory Verification Checklist
      </div>
      <ul className="sq-checks">
        <li className="sq-check">
          <label className="sq-check-label">
            <input
              type="checkbox"
              className="sq-check-input"
              aria-label="Scope authorisation verified"
              checked={checks.scope_authorisation_verified}
              disabled={disabled}
              onChange={() => onToggle('scope_authorisation_verified')}
            />
            <span className="sq-check-text">
              <span className="sq-check-title">Scope authorisation verified</span>
              <span className="sq-check-desc">
                Signed authorisation on file covers every host in the target list.
              </span>
            </span>
          </label>
        </li>
        <li className="sq-check">
          <label className="sq-check-label">
            <input
              type="checkbox"
              className="sq-check-input"
              aria-label="Evidence sanitised"
              checked={checks.evidence_sanitised}
              disabled={disabled}
              onChange={() => onToggle('evidence_sanitised')}
            />
            <span className="sq-check-text">
              <span className="sq-check-title">Evidence sanitised</span>
              <span className="sq-check-desc">
                No production data, credentials or personal information in the report.
              </span>
            </span>
          </label>
        </li>
        <li className="sq-check">
          <label className="sq-check-label">
            <input
              type="checkbox"
              className="sq-check-input"
              aria-label="Critical & high findings manually validated"
              checked={checks.critical_high_validated}
              disabled={disabled}
              onChange={() => onToggle('critical_high_validated')}
            />
            <span className="sq-check-text">
              <span className="sq-check-title">Critical & high findings manually validated</span>
              <span className="sq-check-desc">
                Each severe finding independently reproduced by the reviewer.
              </span>
            </span>
          </label>
        </li>
        <li className="sq-check">
          <label className="sq-check-label">
            <input
              type="checkbox"
              className="sq-check-input"
              aria-label="Remediation guidance attached"
              checked={checks.remediation_guidance_attached}
              disabled={disabled}
              onChange={() => onToggle('remediation_guidance_attached')}
            />
            <span className="sq-check-text">
              <span className="sq-check-title">Remediation guidance attached</span>
              <span className="sq-check-desc">
                Prioritised fixes and a re-test window are included in the report.
              </span>
            </span>
          </label>
        </li>
        <li className="sq-check">
          <label className="sq-check-label">
            <input
              type="checkbox"
              className="sq-check-input"
              aria-label="Client-ready redaction approved"
              checked={checks.client_redaction_approved}
              disabled={disabled}
              onChange={() => onToggle('client_redaction_approved')}
            />
            <span className="sq-check-text">
              <span className="sq-check-title">Client-ready redaction approved</span>
              <span className="sq-check-desc">
                Exploit payloads are safely truncated for the client-facing copy.
              </span>
            </span>
          </label>
        </li>
      </ul>
    </div>
  );
}
