import { describe, expect, it } from 'vitest';
import { emailFor, inAppNotification, IN_APP_BODY_MAX, SMS_BODY_MAX, smsFor } from './templates.js';
import type { AdvisoryDeliveryView } from '../ports.js';

function advisory(overrides: Partial<AdvisoryDeliveryView> = {}): AdvisoryDeliveryView {
  return {
    id: 'a1d5c000-0000-4000-8000-000000000001',
    cveId: 'CVE-2026-31337',
    title: 'Struts remote code execution in file uploads',
    summary: 'A malicious multipart upload can execute arbitrary commands.',
    remediation: 'Upgrade to Struts 6.4.0 or later.',
    references: [
      'https://struts.apache.org/release-notes',
      'https://nvd.nist.gov/vuln/detail/CVE-2026-31337',
    ],
    severity: 'critical',
    cvss: '9.8',
    status: 'published',
    scope: [{ label: 'Web & API · Struts 2.0.0 – 6.3.0', category: null }],
    disclosureDate: '2026-09-20',
    ...overrides,
  };
}

describe('inAppNotification', () => {
  it('titles an initial/rebroadcast notification with the CVE id', () => {
    expect(inAppNotification(advisory(), 'initial').title).toBe(
      'Emergency advisory: CVE-2026-31337',
    );
    expect(inAppNotification(advisory(), 'rebroadcast').title).toBe(
      'Emergency advisory: CVE-2026-31337',
    );
  });

  it('titles a retraction differently', () => {
    expect(inAppNotification(advisory(), 'retraction').title).toBe(
      'Advisory retracted: CVE-2026-31337',
    );
  });

  it('uses the summary as the body', () => {
    expect(inAppNotification(advisory(), 'initial').body).toBe(advisory().summary);
  });

  it('truncates a long body at the cap with an ellipsis', () => {
    const long = 'x'.repeat(IN_APP_BODY_MAX + 50);
    const body = inAppNotification(advisory({ summary: long }), 'initial').body;
    expect(body).toHaveLength(IN_APP_BODY_MAX);
    expect(body.endsWith('…')).toBe(true);
  });

  it('falls back to the title when the summary is null', () => {
    expect(inAppNotification(advisory({ summary: null }), 'initial').body).toBe(advisory().title);
  });
});

describe('emailFor', () => {
  it('builds the initial subject', () => {
    expect(emailFor(advisory(), 'initial').subject).toBe(
      '[VUNVAULT] CVE-2026-31337 — Struts remote code execution in file uploads',
    );
  });

  it('prefixes a rebroadcast subject with Reminder:', () => {
    expect(emailFor(advisory(), 'rebroadcast').subject).toBe(
      '[VUNVAULT] Reminder: CVE-2026-31337 — Struts remote code execution in file uploads',
    );
  });

  it('marks a retraction subject', () => {
    expect(emailFor(advisory(), 'retraction').subject).toBe(
      '[VUNVAULT] RETRACTED: CVE-2026-31337 — Struts remote code execution in file uploads',
    );
  });

  it('lays out the advisory body exactly', () => {
    const { text } = emailFor(advisory(), 'initial');
    expect(text).toBe(
      [
        'Struts remote code execution in file uploads',
        '',
        'Severity: critical · CVSS 9.8',
        'Disclosed: 2026-09-20',
        '',
        'A malicious multipart upload can execute arbitrary commands.',
        '',
        'Remediation:',
        'Upgrade to Struts 6.4.0 or later.',
        '',
        'References:',
        'https://struts.apache.org/release-notes',
        'https://nvd.nist.gov/vuln/detail/CVE-2026-31337',
        '',
        '—',
        'VUNVAULT Emergency Advisory · CVE-2026-31337 · Automated notification, do not reply.',
      ].join('\n'),
    );
  });

  it('omits the references block when there are none', () => {
    const { text } = emailFor(advisory({ references: [] }), 'initial');
    expect(text).not.toContain('References:');
  });

  it('omits the CVSS suffix when the score is null', () => {
    const { text } = emailFor(advisory({ cvss: null }), 'initial');
    expect(text).toContain('Severity: critical\n');
    expect(text).not.toContain('CVSS');
  });

  it('renders an unknown disclosure date and severity honestly', () => {
    const { text } = emailFor(advisory({ disclosureDate: null, severity: null }), 'initial');
    expect(text).toContain('Severity: unknown');
    expect(text).toContain('Disclosed: unknown');
  });

  it('builds the retraction body', () => {
    const { text } = emailFor(advisory(), 'retraction');
    expect(text).toBe(
      [
        'This advisory has been retracted and should no longer be acted on.',
        '',
        'Original title: Struts remote code execution in file uploads',
        '',
        '—',
        'VUNVAULT Emergency Advisory · CVE-2026-31337 · Automated notification, do not reply.',
      ].join('\n'),
    );
  });
});

describe('smsFor', () => {
  it('leads with the identifier and severity', () => {
    expect(smsFor(advisory())).toBe(
      'VUNVAULT: CVE-2026-31337 Struts remote code execution in file uploads. Severity critical. A malicious multipart upload can execute arbitrary commands.',
    );
  });

  it('never exceeds the notify-contract SMS cap', () => {
    const long = 'y'.repeat(2000);
    const body = smsFor(advisory({ summary: long }));
    expect(body.length).toBeLessThanOrEqual(SMS_BODY_MAX);
    expect(body.startsWith('VUNVAULT: CVE-2026-31337')).toBe(true);
    expect(body.endsWith('…')).toBe(true);
  });

  it('keeps the identifier intact even when the title is long', () => {
    const body = smsFor(advisory({ title: 't'.repeat(600), summary: null }));
    expect(body.length).toBeLessThanOrEqual(SMS_BODY_MAX);
    expect(body).toContain('CVE-2026-31337');
  });
});
