'use client';

import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import type { FindingSeverity } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { SEVERITY_LABELS, SEVERITY_ORDER, cvssBandHint } from '../_lib/cvss';

/**
 * Severity picker (Task 81) — the four radio cards under the `Severity Level`
 * legend, each labelled with its CVSS band from the contract's
 * `SEVERITY_CVSS_HINTS` so the picker and the database CHECK can never drift.
 *
 * The picker is *controlled*: the editor auto-selects from the CVSS score and
 * the operator may override it, which is exactly when the mismatch warning
 * becomes true. Real radios (not `aria-pressed` buttons) so the arrow keys
 * move the selection for free.
 *
 * `aria-invalid` is deliberately NOT put on the radios — the `radio` role does
 * not support it — so an invalid group is announced through `aria-describedby`
 * on the `radiogroup` instead, and the mismatch warning is a live region.
 */

export interface SeverityPickerProps {
  /** Radio group name — the editor owns it so the ids stay unique per form. */
  name: string;
  value: FindingSeverity | '';
  onChange(severity: FindingSeverity): void;
  /** True when a manually chosen severity disagrees with the CVSS band. */
  mismatch: boolean;
  /** Group-level error text (e.g. the contract's "a severity level" rule). */
  error?: string;
}

export function SeverityPicker({ name, value, onChange, mismatch, error }: SeverityPickerProps) {
  const errorId = useId();
  const describedBy = error === undefined ? undefined : errorId;

  return (
    <>
      <div
        className="zd-sev-grid"
        role="radiogroup"
        aria-label="Severity Level"
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy}
      >
        {SEVERITY_ORDER.map((severity) => {
          const id = `${name}-${severity}`;
          // The label IS the card: one wrapper element, so the option text sits
          // within the depth jsx-a11y inspects for an accessible label.
          return (
            <label
              key={severity}
              className={cn('zd-sev-option', `zd-sev-option--${severity}`)}
              htmlFor={id}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={severity}
                checked={value === severity}
                onChange={() => onChange(severity)}
              />
              <span className="zd-sev-name">{SEVERITY_LABELS[severity]}</span>
              <span className="zd-sev-band">{cvssBandHint(severity)}</span>
            </label>
          );
        })}
      </div>
      {error === undefined ? null : (
        <p className="zd-error" id={errorId}>
          {error}
        </p>
      )}
      {mismatch ? (
        <p className="zd-warning" role="status">
          <AlertCircle size={13} aria-hidden="true" />
          <span>Severity does not match the CVSS score.</span>
        </p>
      ) : null}
    </>
  );
}
