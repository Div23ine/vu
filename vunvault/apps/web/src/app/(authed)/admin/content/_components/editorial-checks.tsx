'use client';

import { ListChecks } from 'lucide-react';

/**
 * Mandatory Editorial Checklist (Task 83) — the five checks a reviewer must
 * clear before an approval, titles and descriptions verbatim from the
 * reference markup.
 *
 * `@vunvault/contracts` has no editorial-check map (unlike Task 78's
 * `REVIEW_CHECK_LABELS`), so the catalogue lives here and the check state is a
 * UI-only gate: `ModerationActionBody` carries `{ action, note?, scheduledFor? }`
 * and no checklist payload, which matches the spec — "Approve requires all five
 * checks (UI rule; the API enforces separation of duties)".
 *
 * The items are written out statically rather than mapped over the record (the
 * `gate-checklist.tsx` precedent): `jsx-a11y/label-has-associated-control`
 * verifies a label's accessible text statically, which dynamic `{expression}`
 * children defeat. `content.test.tsx` asserts these literals against
 * `EDITORIAL_CHECKS` so they cannot drift.
 */

export const EDITORIAL_CHECKS = {
  technical_accuracy: {
    title: 'Technical accuracy verified',
    description:
      'Every technical claim traces to a citation, internal test result or public advisory.',
  },
  no_private_data: {
    title: 'No client or personal data present',
    description: 'Screenshots, logs and case studies are fully anonymised.',
  },
  legal_cleared: {
    title: 'Legal review cleared (where flagged)',
    description: 'Named entities, government references and vendor attribution are signed off.',
  },
  brand_voice: {
    title: 'Brand voice and terminology consistent',
    description: 'Tone, product naming and formatting match the VUNVAULT editorial standard.',
  },
  publication_path: {
    title: 'Publication path decided',
    description: 'Immediate, scheduled or client-only release has been agreed with the author.',
  },
} as const;

export type EditorialCheckKey = keyof typeof EDITORIAL_CHECKS;

/** Contract order — the dialog's counting logic and the test both read this. */
export const EDITORIAL_CHECK_KEYS = Object.keys(EDITORIAL_CHECKS) as EditorialCheckKey[];

export type EditorialChecksState = Record<EditorialCheckKey, boolean>;

export const EMPTY_CHECKS: EditorialChecksState = EDITORIAL_CHECK_KEYS.reduce(
  (accumulator, key) => {
    accumulator[key] = false;
    return accumulator;
  },
  {} as EditorialChecksState,
);

export interface EditorialChecksProps {
  checks: EditorialChecksState;
  disabled?: boolean;
  onToggle(key: EditorialCheckKey): void;
}

export function EditorialChecks({ checks, disabled = false, onToggle }: EditorialChecksProps) {
  return (
    <div>
      <div className="cm-modal-section-title">
        <ListChecks size={13} aria-hidden="true" />
        Mandatory Editorial Checklist
      </div>
      <ul className="cm-checks">
        <li className="cm-check">
          <label className="cm-check-label">
            <input
              type="checkbox"
              className="cm-check-input"
              aria-label="Technical accuracy verified"
              checked={checks.technical_accuracy}
              disabled={disabled}
              onChange={() => onToggle('technical_accuracy')}
            />
            <span className="cm-check-text">
              <span className="cm-check-title">Technical accuracy verified</span>
              <span className="cm-check-desc">
                Every technical claim traces to a citation, internal test result or public advisory.
              </span>
            </span>
          </label>
        </li>
        <li className="cm-check">
          <label className="cm-check-label">
            <input
              type="checkbox"
              className="cm-check-input"
              aria-label="No client or personal data present"
              checked={checks.no_private_data}
              disabled={disabled}
              onChange={() => onToggle('no_private_data')}
            />
            <span className="cm-check-text">
              <span className="cm-check-title">No client or personal data present</span>
              <span className="cm-check-desc">
                Screenshots, logs and case studies are fully anonymised.
              </span>
            </span>
          </label>
        </li>
        <li className="cm-check">
          <label className="cm-check-label">
            <input
              type="checkbox"
              className="cm-check-input"
              aria-label="Legal review cleared (where flagged)"
              checked={checks.legal_cleared}
              disabled={disabled}
              onChange={() => onToggle('legal_cleared')}
            />
            <span className="cm-check-text">
              <span className="cm-check-title">Legal review cleared (where flagged)</span>
              <span className="cm-check-desc">
                Named entities, government references and vendor attribution are signed off.
              </span>
            </span>
          </label>
        </li>
        <li className="cm-check">
          <label className="cm-check-label">
            <input
              type="checkbox"
              className="cm-check-input"
              aria-label="Brand voice and terminology consistent"
              checked={checks.brand_voice}
              disabled={disabled}
              onChange={() => onToggle('brand_voice')}
            />
            <span className="cm-check-text">
              <span className="cm-check-title">Brand voice and terminology consistent</span>
              <span className="cm-check-desc">
                Tone, product naming and formatting match the VUNVAULT editorial standard.
              </span>
            </span>
          </label>
        </li>
        <li className="cm-check">
          <label className="cm-check-label">
            <input
              type="checkbox"
              className="cm-check-input"
              aria-label="Publication path decided"
              checked={checks.publication_path}
              disabled={disabled}
              onChange={() => onToggle('publication_path')}
            />
            <span className="cm-check-text">
              <span className="cm-check-title">Publication path decided</span>
              <span className="cm-check-desc">
                Immediate, scheduled or client-only release has been agreed with the author.
              </span>
            </span>
          </label>
        </li>
      </ul>
    </div>
  );
}
