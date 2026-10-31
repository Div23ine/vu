import type { AdvisoryDeliveryView } from '../ports';

/**
 * Broadcast copy (Task 89) — planner-authored; no prototype exists for these
 * notifications, so the strings below are the single source of truth and the
 * tests pin them exactly.
 *
 * Rules baked in here:
 *  - every channel gets the CVE id first: a client triaging a page of alerts
 *    matches on the CVE, not on our prose;
 *  - the SMS is capped at 480 characters (the `notify` contract's limit) and
 *    the summary is what gets truncated — the identifier and severity survive;
 *  - a retraction says plainly that the advisory must no longer be acted on.
 */

/** In-app body cap: `notifications.body` allows 600, the tile shows far less. */
export const IN_APP_BODY_MAX = 160;
/** `NotifyJobPayload` caps an SMS body at 480 characters. */
export const SMS_BODY_MAX = 480;

export type BroadcastCopyKind = 'initial' | 'rebroadcast' | 'retraction';

function truncate(value: string, max: number): string {
  if (max <= 0) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function severityOf(advisory: AdvisoryDeliveryView): string {
  return advisory.severity ?? 'unknown';
}

function cvssSuffix(advisory: AdvisoryDeliveryView): string {
  if (advisory.cvss === null) return '';
  const parsed = Number.parseFloat(advisory.cvss);
  if (Number.isNaN(parsed)) return '';
  return ` · CVSS ${parsed.toFixed(1)}`;
}

/** In-app inbox notification (enqueued onto the `notify` queue per contact). */
export function inAppNotification(
  advisory: AdvisoryDeliveryView,
  kind: BroadcastCopyKind,
): { title: string; body: string } {
  const summary = advisory.summary ?? advisory.title;
  return {
    title:
      kind === 'retraction'
        ? `Advisory retracted: ${advisory.cveId}`
        : `Emergency advisory: ${advisory.cveId}`,
    body: truncate(summary, IN_APP_BODY_MAX),
  };
}

export interface BroadcastEmail {
  subject: string;
  text: string;
}

const FOOTER_LINES = [
  '—',
  'VUNVAULT Emergency Advisory · {{cveId}} · Automated notification, do not reply.',
] as const;

function footer(cveId: string): string[] {
  return [FOOTER_LINES[0], FOOTER_LINES[1].replace('{{cveId}}', cveId)];
}

/** The plain-text e-mail for one advisory broadcast. */
export function emailFor(advisory: AdvisoryDeliveryView, kind: BroadcastCopyKind): BroadcastEmail {
  if (kind === 'retraction') {
    return {
      subject: `[VUNVAULT] RETRACTED: ${advisory.cveId} — ${advisory.title}`,
      text: [
        'This advisory has been retracted and should no longer be acted on.',
        '',
        `Original title: ${advisory.title}`,
        '',
        ...footer(advisory.cveId),
      ].join('\n'),
    };
  }

  const prefix = kind === 'rebroadcast' ? 'Reminder: ' : '';
  const lines: string[] = [
    advisory.title,
    '',
    `Severity: ${severityOf(advisory)}${cvssSuffix(advisory)}`,
    `Disclosed: ${advisory.disclosureDate ?? 'unknown'}`,
    '',
    advisory.summary ?? '',
    '',
    'Remediation:',
    advisory.remediation ?? '',
  ];

  if (advisory.references.length > 0) {
    lines.push('', 'References:', ...advisory.references);
  }

  lines.push('', ...footer(advisory.cveId));

  return {
    subject: `[VUNVAULT] ${prefix}${advisory.cveId} — ${advisory.title}`,
    text: lines.join('\n'),
  };
}

/**
 * The SMS for an INITIAL broadcast only — a rebroadcast must not re-page
 * phones, and a retraction is e-mail/in-app (planner decision, spec-task89).
 *
 * The identifier and severity always survive: the title takes what is left of
 * the 480-character budget, and the summary fills the remainder.
 */
export function smsFor(advisory: AdvisoryDeliveryView): string {
  const prefix = `VUNVAULT: ${advisory.cveId} `;
  const suffix = `. Severity ${severityOf(advisory)}. `;
  const titleRoom = SMS_BODY_MAX - prefix.length - suffix.length;
  const head = `${prefix}${truncate(advisory.title, titleRoom)}${suffix}`;
  const room = SMS_BODY_MAX - head.length;
  return `${head}${truncate(advisory.summary ?? '', room)}`;
}
