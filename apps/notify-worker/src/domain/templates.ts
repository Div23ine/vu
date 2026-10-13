/**
 * E-mail template registry (Task 90) — planner-authored copy; no prototype
 * exists for transactional e-mail, so this file is the single source of truth
 * and the tests pin the rendered output.
 *
 * Every template name a producer can enqueue is registered here. Two families
 * exist:
 *
 *  1. DISPATCHER templates — `NotificationDispatcher` (apps/api/src/lib/notify.ts)
 *     enqueues e-mail jobs with `template: <event>` and `vars: { title, body }`
 *     for the eleven `NotificationEvent` names:
 *       signin_new_device, credentials_changed, failed_auth, scan_completed,
 *       job_awaiting_review, critical_finding, advisory_broadcast,
 *       threat_level_change, content_awaiting_moderation,
 *       team_member_provisioned, weekly_digest
 *     They render `title`/`body` straight through. `credentials_changed` is
 *     ALSO enqueued directly by the auth and account-security routes with
 *     `vars: { userId }` — the renderer detects the missing `title` and falls
 *     back to fixed security copy (the raw user id is never printed).
 *
 *  2. PRODUCER templates — explicit names with their own vars:
 *       contact_received      { category, subject, from, messageId }
 *       contact_acknowledged  { name, category, reference }
 *       licence_granted       { productName, licenseKey, updatesUntil }
 *       invoice_issued        { jobCode, planName, invoiceNumber, targetHost }
 *       payment_receipt       { invoiceNumber, txnCode, provider }
 *       payment_failed        { invoiceNumber, txnCode, provider, reason }
 *       content_approve | content_request_changes | content_reject |
 *       content_publish | content_schedule | content_remind_author
 *                             { title, slugPath, action }
 *       chain_broken        { firstMismatchSeq, mismatches }   (Task 92)
 *
 * An UNKNOWN template is never dropped: `renderEmail` falls back to a generic
 * envelope listing the vars, and the handler logs `unknown_template` so the
 * gap shows up in observability instead of a client's spam folder silence.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
}

export interface RenderResult extends RenderedEmail {
  /** False when the generic fallback rendered it. */
  known: boolean;
}

const SUBJECT_PREFIX = '[VUNVAULT]';
const FOOTER = ['—', 'VUNVAULT · Automated notification, do not reply.'];

/** Vars values are capped so a rogue producer cannot build a megabyte mail. */
const VAR_VALUE_MAX = 200;

function clip(value: string | undefined, fallback = ''): string {
  if (value === undefined || value === '') return fallback;
  return value.length > VAR_VALUE_MAX ? `${value.slice(0, VAR_VALUE_MAX - 1)}…` : value;
}

function lines(...parts: Array<string | string[]>): string {
  return [...parts.flat(), ...FOOTER].join('\n');
}

type TemplateRenderer = (vars: Record<string, string>) => RenderedEmail;

const dispatcherFamily: TemplateRenderer = (vars) => ({
  subject: `${SUBJECT_PREFIX} ${clip(vars.title, 'Notification')}`,
  text: lines(clip(vars.body)),
});

/** The eleven `NotificationEvent` names the dispatcher uses as templates. */
const DISPATCHER_TEMPLATES = [
  'signin_new_device',
  'failed_auth',
  'scan_completed',
  'job_awaiting_review',
  'critical_finding',
  'advisory_broadcast',
  'threat_level_change',
  'content_awaiting_moderation',
  'team_member_provisioned',
  'weekly_digest',
] as const;

const CONTENT_ACTION_COPY: Record<string, { subject: string; line: string }> = {
  content_approve: {
    subject: 'Your article was approved',
    line: 'Your submission passed moderation and is ready to go live.',
  },
  content_request_changes: {
    subject: 'Changes requested on your article',
    line: 'A moderator has requested changes before your submission can proceed.',
  },
  content_reject: {
    subject: 'Your article was not accepted',
    line: 'Your submission was not accepted in its current form; the review notes are in Content Studio.',
  },
  content_publish: {
    subject: 'Your article is live',
    line: 'Your submission has been published.',
  },
  content_schedule: {
    subject: 'Your article is scheduled',
    line: 'Your submission is scheduled and will publish automatically.',
  },
  content_remind_author: {
    subject: 'Reminder: your article needs attention',
    line: 'Your submission is waiting on you in Content Studio.',
  },
};

const TEMPLATES: Record<string, TemplateRenderer> = {
  // Dispatcher family: subject/body come from the event itself.
  ...Object.fromEntries(DISPATCHER_TEMPLATES.map((name) => [name, dispatcherFamily])),

  // credentials_changed has two producers (see the header): prefer the
  // dispatcher's title/body, fall back to fixed security copy otherwise.
  credentials_changed: (vars) =>
    vars.title !== undefined
      ? dispatcherFamily(vars)
      : {
          subject: `${SUBJECT_PREFIX} Your security credentials changed`,
          text: lines(
            'A security credential on your VUNVAULT account was changed.',
            '',
            'If this was not you, sign in and rotate your password immediately, then contact support.',
          ),
        },

  contact_received: (vars) => ({
    subject: `${SUBJECT_PREFIX} New contact message: ${clip(vars.subject, '(no subject)')}`,
    text: lines(
      `Category: ${clip(vars.category, 'unknown')}`,
      `From: ${clip(vars.from, 'unknown')}`,
      `Message id: ${clip(vars.messageId, 'unknown')}`,
      '',
      'Read and reply from the admin Contact Inbox.',
    ),
  }),

  contact_acknowledged: (vars) => ({
    subject: `${SUBJECT_PREFIX} We received your message`,
    text: lines(
      `Hello ${clip(vars.name, 'there')},`,
      '',
      `Thanks for contacting VUNVAULT. Your reference is ${clip(vars.reference, 'unavailable')}.`,
      'Our team will reply to this address.',
    ),
  }),

  licence_granted: (vars) => ({
    subject: `${SUBJECT_PREFIX} Your licence key for ${clip(vars.productName, 'your purchase')}`,
    text: lines(
      `Licence key: ${clip(vars.licenseKey, 'unavailable')}`,
      `Updates until: ${clip(vars.updatesUntil, 'see portal')}`,
      '',
      'Download your files any time from the Licences & downloads page in your portal.',
    ),
  }),

  invoice_issued: (vars) => ({
    subject: `${SUBJECT_PREFIX} Invoice ${clip(vars.invoiceNumber, '')} for ${clip(vars.jobCode, 'your assessment')}`,
    text: lines(
      `An invoice has been issued for your assessment of ${clip(vars.targetHost, 'your target')}.`,
      `Invoice: ${clip(vars.invoiceNumber, 'unavailable')}`,
      `Plan: ${clip(vars.planName, 'unavailable')}`,
      '',
      'Pay or download it from the Billing & Invoices page in your portal.',
    ),
  }),

  payment_receipt: (vars) => ({
    subject: `${SUBJECT_PREFIX} Payment received — invoice ${clip(vars.invoiceNumber, '')}`,
    text: lines(
      'We received your payment.',
      `Invoice: ${clip(vars.invoiceNumber, 'unavailable')}`,
      `Transaction: ${clip(vars.txnCode, 'unavailable')}`,
      `Provider: ${clip(vars.provider, 'unavailable')}`,
    ),
  }),

  // Task 92: the maintenance worker's chain-verification alert.
  chain_broken: (vars) => ({
    subject: `${SUBJECT_PREFIX} AUDIT CHAIN MISMATCH — immediate review required`,
    text: lines(
      'Scheduled verification of the audit hash chain found mismatches.',
      `First mismatched entry: seq ${clip(vars.firstMismatchSeq, 'unknown')}`,
      `Mismatched entries in the verified range: ${clip(vars.mismatches, 'unknown')}`,
      '',
      'Treat this as a possible tampering incident: run the on-demand verification from the admin Audit Logs page and follow the incident runbook.',
    ),
  }),

  payment_failed: (vars) => ({
    subject: `${SUBJECT_PREFIX} Payment failed — invoice ${clip(vars.invoiceNumber, '')}`,
    text: lines(
      'Your payment could not be completed.',
      `Reason: ${clip(vars.reason, 'unavailable')}`,
      `Invoice: ${clip(vars.invoiceNumber, 'unavailable')}`,
      `Transaction: ${clip(vars.txnCode, 'unavailable')}`,
      '',
      'You can retry from the Billing & Invoices page in your portal.',
    ),
  }),

  ...Object.fromEntries(
    Object.entries(CONTENT_ACTION_COPY).map(([name, copy]) => [
      name,
      ((vars: Record<string, string>) => ({
        subject: `${SUBJECT_PREFIX} ${copy.subject}`,
        text: lines(clip(vars.title, 'Your submission'), '', copy.line),
      })) satisfies TemplateRenderer,
    ]),
  ),
};

/** Every registered template name — the conformance test walks this list. */
export const TEMPLATE_NAMES = Object.keys(TEMPLATES).sort();

/** True when the registry knows this template. */
export function isKnownTemplate(template: string): boolean {
  return Object.hasOwn(TEMPLATES, template);
}

function fallback(template: string, vars: Record<string, string>): RenderedEmail {
  const body = Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${clip(value)}`);
  return {
    subject: `${SUBJECT_PREFIX} Notification (${template})`,
    text: lines(...body),
  };
}

/**
 * Render an e-mail. Unknown templates fall back to the generic envelope and
 * return `known: false` — the handler logs that, but the mail still goes out:
 * a missing registry entry must never silently swallow a notification.
 */
export function renderEmail(template: string, vars: Record<string, string>): RenderResult {
  const renderer = TEMPLATES[template];
  if (renderer === undefined) {
    return { ...fallback(template, vars), known: false };
  }
  return { ...renderer(vars), known: true };
}
