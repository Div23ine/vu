import { ShieldCheck } from 'lucide-react';
import '../_styles/scan-queue.css';

/**
 * Mandatory Admin Review Gate card — the dark policy card that
 * closes the page: the four numbered verification steps and the release-lock
 * alert, all verbatim from the reference. Presentational; the five CHECKS
 * themselves are the an earlier iteration dialog's (contract `REVIEW_CHECK_LABELS`).
 */

const GATE_STEPS = [
  {
    num: '01',
    title: 'Scope Authorisation Verified',
    text: 'Confirm the signed authorisation document covers every host in the target list and that the testing window has not expired.',
  },
  {
    num: '02',
    title: 'Evidence Sanitised',
    text: 'Ensure no live client production data, credentials or personal information is embedded in screenshots, payloads or proof-of-concept output.',
  },
  {
    num: '03',
    title: 'Findings Manually Validated',
    text: 'Every critical and high severity finding must be independently reproduced and confirmed by the reviewing administrator before it reaches the client.',
  },
  {
    num: '04',
    title: 'Remediation Guidance Attached',
    text: 'The report must ship with prioritised, actionable remediation steps and a re-test window before the release flag can be flipped.',
  },
] as const;

export function QueueFooterCard() {
  return (
    <section className="adm-card adm-card--dark sq-gate-card" aria-labelledby="sq-gate-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="sq-gate-heading">
            <ShieldCheck size={17} aria-hidden="true" />
            Mandatory Admin Review Gate
          </h2>
          <p className="adm-card-note">
            No penetration test result leaves the platform without a human administrator clearing
            four mandatory verification steps. This gate cannot be bypassed, delegated or automated.
          </p>
        </div>
        <span className="adm-tag adm-tag--crit">Enforced</span>
      </div>
      <div className="adm-card-body">
        <ol className="sq-gate-steps">
          {GATE_STEPS.map((step) => (
            <li className="sq-gate-step" key={step.num}>
              <span className="sq-gate-step-num">{step.num}</span>
              <span className="sq-gate-step-title">{step.title}</span>
              <span className="sq-gate-step-text">{step.text}</span>
            </li>
          ))}
        </ol>
        <div className="sq-gate-alert">
          <ShieldCheck size={16} aria-hidden="true" />
          <span className="sq-gate-alert-text">
            <strong>Release lock:</strong> Jobs sitting in <em>Awaiting Review</em>,{' '}
            <em>In Review</em>, <em>Held</em> or <em>Blocked — Payment</em> are invisible to the
            client portal. Attempting to release a locked job raises a{' '}
            <strong>SEV-2 audit event</strong> and notifies the incident commander on duty.
          </span>
        </div>
      </div>
    </section>
  );
}
