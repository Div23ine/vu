'use client';

import { scorePassword } from '@vunvault/contracts';
import '../../_styles/signup.css';

/**
 * Password strength meter (Task 61) — four bars plus a label, driven by the
 * shared `scorePassword()` scorer from `@vunvault/contracts` (0–4 →
 * `Awaiting input` / `Weak` / `Fair` / `Good` / `Strong`). The prototype's
 * static `—` placeholder is what the label shows before its JS runs; here the
 * scorer's own level-0 label (`Awaiting input`) is the empty state.
 *
 * The container carries the prototype's `data-level` attribute (the CSS fills
 * bars and tints the label from it). Task 63 reuses this component on the
 * dark auth card — the styles are token-only and live in `signup.css`, which
 * this component imports itself.
 */

export interface PasswordStrengthProps {
  /** Current value of the password field ('' while untouched). */
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label } = scorePassword(password);
  return (
    <div className="vv-strength" data-level={score}>
      <div className="vv-strength-bars" aria-hidden="true">
        <span className="vv-strength-bar" />
        <span className="vv-strength-bar" />
        <span className="vv-strength-bar" />
        <span className="vv-strength-bar" />
      </div>
      <span className="vv-strength-label" role="status" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
