import { describe, expect, it } from 'vitest';
import { isKnownTemplate, renderEmail, TEMPLATE_NAMES } from './templates';

describe('template registry', () => {
  it('covers every dispatcher event template', () => {
    for (const name of [
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
      'credentials_changed',
    ]) {
      expect(isKnownTemplate(name), name).toBe(true);
    }
  });

  it('covers every producer template', () => {
    for (const name of [
      'contact_received',
      'contact_acknowledged',
      'licence_granted',
      'invoice_issued',
      'payment_receipt',
      'payment_failed',
      'content_approve',
      'content_request_changes',
      'content_reject',
      'content_publish',
      'content_schedule',
      'content_remind_author',
      'chain_broken',
    ]) {
      expect(isKnownTemplate(name), name).toBe(true);
    }
  });

  it('lists its names for the conformance walk', () => {
    expect(TEMPLATE_NAMES.length).toBeGreaterThanOrEqual(24);
    expect(TEMPLATE_NAMES).toEqual([...TEMPLATE_NAMES].sort());
  });

  it('prefixes every subject and ends every body with the footer', () => {
    for (const name of TEMPLATE_NAMES) {
      const rendered = renderEmail(name, { title: 'T', body: 'B' });
      expect(rendered.subject.startsWith('[VUNVAULT]'), name).toBe(true);
      expect(
        rendered.text.endsWith('—\nVUNVAULT · Automated notification, do not reply.'),
        name,
      ).toBe(true);
    }
  });
});

describe('dispatcher family', () => {
  it('passes title and body straight through', () => {
    const rendered = renderEmail('scan_completed', {
      title: 'Scan JOB-4471 completed',
      body: 'Your scan of api.example.co.ke finished and is awaiting release.',
    });
    expect(rendered.known).toBe(true);
    expect(rendered.subject).toBe('[VUNVAULT] Scan JOB-4471 completed');
    expect(rendered.text).toContain('Your scan of api.example.co.ke finished');
  });

  it('credentials_changed prefers the dispatcher copy', () => {
    const rendered = renderEmail('credentials_changed', {
      title: 'Your password was changed',
      body: 'If this was not you, contact support immediately.',
    });
    expect(rendered.subject).toBe('[VUNVAULT] Your password was changed');
  });

  it('credentials_changed falls back to fixed security copy for the direct producer', () => {
    const rendered = renderEmail('credentials_changed', { userId: 'abc-123' });
    expect(rendered.subject).toBe('[VUNVAULT] Your security credentials changed');
    // The raw user id must never be printed into a mail body.
    expect(rendered.text).not.toContain('abc-123');
    expect(rendered.text).toContain('rotate your password');
  });
});

describe('producer templates', () => {
  it('renders contact_acknowledged with the reference', () => {
    const rendered = renderEmail('contact_acknowledged', {
      name: 'Wanjiku',
      category: 'general_support',
      reference: '11111111-1111-4111-8111-111111111111',
    });
    expect(rendered.subject).toBe('[VUNVAULT] We received your message');
    expect(rendered.text).toContain('Hello Wanjiku,');
    expect(rendered.text).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('renders invoice_issued with all four producer vars', () => {
    const rendered = renderEmail('invoice_issued', {
      jobCode: 'JOB-4471',
      planName: 'Starter Scan',
      invoiceNumber: 'VV-INV-2026-0841',
      targetHost: 'api.horizonsacco.co.ke',
    });
    expect(rendered.subject).toBe('[VUNVAULT] Invoice VV-INV-2026-0841 for JOB-4471');
    expect(rendered.text).toContain('api.horizonsacco.co.ke');
    expect(rendered.text).toContain('Plan: Starter Scan');
  });

  it('renders payment_failed with the reason', () => {
    const rendered = renderEmail('payment_failed', {
      invoiceNumber: 'VV-INV-2026-0842',
      txnCode: 'VX-90241',
      provider: 'paystack',
      reason: 'card_declined',
    });
    expect(rendered.subject).toBe('[VUNVAULT] Payment failed — invoice VV-INV-2026-0842');
    expect(rendered.text).toContain('Reason: card_declined');
  });

  it.each([
    ['content_approve', 'Your article was approved'],
    ['content_request_changes', 'Changes requested on your article'],
    ['content_reject', 'Your article was not accepted'],
    ['content_publish', 'Your article is live'],
    ['content_schedule', 'Your article is scheduled'],
    ['content_remind_author', 'Reminder: your article needs attention'],
  ])('renders %s with its fixed subject', (template, subject) => {
    const rendered = renderEmail(template, { title: 'Zero-trust in SACCOs', slugPath: 'zero-trust', action: 'x' });
    expect(rendered.subject).toBe(`[VUNVAULT] ${subject}`);
    expect(rendered.text).toContain('Zero-trust in SACCOs');
  });
});

describe('chain_broken (Task 92)', () => {
  it('names the first mismatched seq and the count', () => {
    const rendered = renderEmail('chain_broken', { firstMismatchSeq: '4217', mismatches: '3' });
    expect(rendered.known).toBe(true);
    expect(rendered.subject).toBe('[VUNVAULT] AUDIT CHAIN MISMATCH — immediate review required');
    expect(rendered.text).toContain('First mismatched entry: seq 4217');
    expect(rendered.text).toContain('Mismatched entries in the verified range: 3');
  });
});

describe('unknown templates', () => {
  it('falls back to a generic envelope listing the vars, sorted and clipped', () => {
    const rendered = renderEmail('mystery_event', {
      zebra: 'z',
      alpha: 'a'.repeat(500),
    });
    expect(rendered.known).toBe(false);
    expect(rendered.subject).toBe('[VUNVAULT] Notification (mystery_event)');
    const alphaLine = rendered.text.split('\n').find((line) => line.startsWith('alpha:'));
    expect(alphaLine).toBeDefined();
    expect(alphaLine?.length).toBeLessThanOrEqual('alpha: '.length + 200);
    // Sorted: alpha before zebra.
    expect(rendered.text.indexOf('alpha:')).toBeLessThan(rendered.text.indexOf('zebra:'));
  });
});
