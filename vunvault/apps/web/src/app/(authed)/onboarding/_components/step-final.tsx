'use client';

import {
  CAREER_LABELS,
  ENTITY_LABELS,
  RECOVERY_QUESTION_LABELS,
  type CareerRole,
  type EntityType,
  type RecoveryQuestion,
} from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../_styles/onboarding.css';
import type { StepPanelProps } from './step-personal';

/**
 * Step 3 — Verification & finalisation (Task 65; overwrites the Task 64 stub).
 *
 * The captured-details review (labels reused verbatim from this form's own
 * fields — the planner gave the section heading but no row copy), the
 * recovery-question select (the five `RECOVERY_QUESTION_LABELS`, placeholder
 * `Choose a recovery question…`), the answer input (`type="text"` with
 * `autocomplete="off"`, per the prototype — NOT masked) and the three
 * required declaration checkboxes with the verbatim label text.
 *
 * Link decisions (no routes were pinned by the planner; the Task 61 legal
 * block is the precedent — `/terms` and `/privacy` rendered as plain `<a>`
 * even though the pages do not exist yet): Terms of Service → `/terms`,
 * Privacy Policy → `/privacy`, Acceptable Use Policy → `/terms` until a
 * dedicated route exists. `written authorisation` is emphasis (`<strong>`),
 * not a link — there is no target for it.
 *
 * Privacy: the answer travels in the submit body once and is cleared from the
 * form by the wizard immediately after — never echoed, logged or kept.
 */

const QUESTION_ORDER = Object.keys(RECOVERY_QUESTION_LABELS) as RecoveryQuestion[];

export function StepFinal({ form }: StepPanelProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const step3 = errors.step3;

  const captured = watch([
    'step1.fullName',
    'step1.email',
    'step2.career',
    'step2.entity',
  ] as const);
  const [capturedName, capturedEmail, capturedCareer, capturedEntity] = captured;
  // The enum fields are undefined at runtime until chosen (the schema types
  // them non-optional because submission requires them).
  const career = capturedCareer as CareerRole | undefined;
  const entity = capturedEntity as EntityType | undefined;

  const capturedRows = [
    { label: 'Full name', value: capturedName },
    { label: 'Email address', value: capturedEmail },
    { label: 'Career / role', value: career === undefined ? '' : CAREER_LABELS[career] },
    { label: 'Entity type', value: entity === undefined ? '' : ENTITY_LABELS[entity] },
  ];

  return (
    <section className="ob-panel" data-step="3" aria-labelledby="obStep3Title">
      <div className="ob-panel-head">
        <div className="ob-panel-index">Step 03 — Verification &amp; finalisation</div>
        <h2 className="ob-panel-title" id="obStep3Title" tabIndex={-1}>
          Confirm and secure your account
        </h2>
        <p className="ob-panel-text">
          Review what we captured, answer one account-recovery question, and confirm the
          declarations below. Your recovery answer is hashed locally — we never store it in plain
          text.
        </p>
      </div>

      <h3 className="ob-subhead">Captured details</h3>
      <dl className="ob-captured-grid">
        {capturedRows.map(({ label, value }) => (
          <div key={label} className="ob-captured-row">
            <dt>{label}</dt>
            <dd>{value === '' ? '—' : value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="ob-subhead">Ready to submit</h3>

      <div className="ob-grid">
        <div className="ob-field">
          <label className="ob-label" htmlFor="obRecoveryQuestion">
            Account recovery question <span aria-hidden="true">*</span>
          </label>
          <select
            className={cn('ob-input', step3?.recoveryQuestion !== undefined && 'is-invalid')}
            id="obRecoveryQuestion"
            aria-invalid={step3?.recoveryQuestion !== undefined}
            aria-describedby="obRecoveryQuestionError"
            {...register('step3.recoveryQuestion')}
          >
            <option value="">Choose a recovery question…</option>
            {QUESTION_ORDER.map((question) => (
              <option key={question} value={question}>
                {RECOVERY_QUESTION_LABELS[question]}
              </option>
            ))}
          </select>
          <span
            className={cn('ob-err', step3?.recoveryQuestion !== undefined && 'is-visible')}
            id="obRecoveryQuestionError"
            role="alert"
            aria-live="polite"
          >
            {step3?.recoveryQuestion?.message}
          </span>
        </div>

        <div className="ob-field">
          <label className="ob-label" htmlFor="obRecoveryAnswer">
            Recovery answer <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step3?.recoveryAnswer !== undefined && 'is-invalid')}
            type="text"
            id="obRecoveryAnswer"
            autoComplete="off"
            aria-invalid={step3?.recoveryAnswer !== undefined}
            aria-describedby="obRecoveryAnswerHint obRecoveryAnswerError"
            {...register('step3.recoveryAnswer')}
          />
          <span className="ob-hint" id="obRecoveryAnswerHint">
            Case-insensitive. Keep it something only you would know.
          </span>
          <span
            className={cn('ob-err', step3?.recoveryAnswer !== undefined && 'is-visible')}
            id="obRecoveryAnswerError"
            role="alert"
            aria-live="polite"
          >
            {step3?.recoveryAnswer?.message}
          </span>
        </div>
      </div>

      <div className="ob-decls">
        <div className="ob-field">
          <label className="ob-decl">
            <input type="checkbox" {...register('step3.declarations.infoAccurate')} />
            <span>
              I confirm that the personal, contact and entity information I provided is accurate,
              current and belongs to me or to an organisation I am authorised to represent.
            </span>
          </label>
          <span
            className={cn(
              'ob-err',
              step3?.declarations?.infoAccurate !== undefined && 'is-visible',
            )}
            id="obDeclInfoError"
            role="alert"
            aria-live="polite"
          >
            {step3?.declarations?.infoAccurate?.message}
          </span>
        </div>

        <div className="ob-field">
          <label className="ob-decl">
            <input type="checkbox" {...register('step3.declarations.authorisedTesting')} />
            <span>
              I confirm I will only request assessments against systems I own or have{' '}
              <strong>written authorisation</strong> to test, and I accept the{' '}
              <a href="/terms">Acceptable Use Policy</a>.
            </span>
          </label>
          <span
            className={cn(
              'ob-err',
              step3?.declarations?.authorisedTesting !== undefined && 'is-visible',
            )}
            id="obDeclAuthError"
            role="alert"
            aria-live="polite"
          >
            {step3?.declarations?.authorisedTesting?.message}
          </span>
        </div>

        <div className="ob-field">
          <label className="ob-decl">
            <input type="checkbox" {...register('step3.declarations.termsAccepted')} />
            <span>
              I agree to the <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>, including the processing of my data for account
              verification and security notifications.
            </span>
          </label>
          <span
            className={cn(
              'ob-err',
              step3?.declarations?.termsAccepted !== undefined && 'is-visible',
            )}
            id="obDeclTermsError"
            role="alert"
            aria-live="polite"
          >
            {step3?.declarations?.termsAccepted?.message}
          </span>
        </div>
      </div>
    </section>
  );
}
