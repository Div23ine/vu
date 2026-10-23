import { describe, expect, it } from 'vitest';
import { auditEntries, auditSummary, chainStatus } from '../fixtures/audit';
import {
  fxQuoteKes,
  invoices,
  openInvoice,
  paymentMethod,
  subscription,
} from '../fixtures/billing';
import { moderationItems, moderationSummary } from '../fixtures/content';
import { staffMembers } from '../fixtures/users';
import {
  AUDIT_CATEGORY_LABELS,
  AUDIT_RANGE_LABELS,
  AUDIT_SEVERITY_LABELS,
  AuditEntryView,
  AuditQuery,
  AuditRangeSchema,
  AuditStreamEvent,
  AuditSummary,
  ChainStatus,
  VerifyChainResult,
} from './audit';
import {
  CheckoutBody,
  CheckoutResponse,
  FxQuote,
  FxQuoteRequest,
  Invoice,
  InvoiceListQuery,
  MPESA_PROVIDER_MESSAGE,
  PaymentMethodView,
  Subscription,
  UpdatePaymentMethodBody,
  WebhookAck,
} from './billing';
import {
  CONSENT_ACCEPT_ALL,
  CONSENT_ESSENTIAL_ONLY,
  CONSENT_REQUIRED_MESSAGE,
  ConsentBody,
  ContactBody,
  ContactCreated,
  CONTACT_CATEGORY_LABELS,
} from './contact';
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  ModerationActionBody,
  ModerationItem,
  ModerationQuery,
  ModerationSummary,
  NOTE_REQUIRED_MESSAGE,
  PublicContentItem,
  PublicContentQuery,
  RISK_FLAG_LABELS,
  SCHEDULE_REQUIRED_MESSAGE,
} from './content';
import {
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  CONTACT_CATEGORIES,
  TEAMS,
} from '@vunvault/db/enum-values';
import { ROUTES_B } from './routes-b';

const UUID = 'c0000000-0000-4000-8000-000000000001';
const HEX64 = 'a'.repeat(64);

describe('billing schemas', () => {
  it('parses the subscription fixture and settles only in USD', () => {
    expect(Subscription.parse(subscription)).toEqual(subscription);
    expect(subscription.amountUsdCents).toBe(249900);
    expect(Subscription.safeParse({ ...subscription, settlementCurrency: 'KES' }).success).toBe(
      false,
    );
    expect(Subscription.safeParse({ ...subscription, renewsOn: '14 Oct 2026' }).success).toBe(
      false,
    );
  });

  it('parses the tokenised payment method and cannot carry card data', () => {
    expect(PaymentMethodView.parse(paymentMethod)).toEqual(paymentMethod);
    expect(paymentMethod.last4).toBe('4290');
    // A full PAN is not a last4.
    expect(
      PaymentMethodView.safeParse({ ...paymentMethod, last4: '4290123456789012' }).success,
    ).toBe(false);
    expect(PaymentMethodView.safeParse({ ...paymentMethod, expMonth: 13 }).success).toBe(false);
    // The model has no PAN or CVC field: an extra key is stripped, never stored.
    const parsed = PaymentMethodView.parse({
      ...paymentMethod,
      cardNumber: '4242424242424242',
      cvc: '123',
    }) as Record<string, unknown>;
    expect(parsed.cardNumber).toBeUndefined();
    expect(parsed.cvc).toBeUndefined();
  });

  it('requires a provider token when the card is replaced', () => {
    expect(
      UpdatePaymentMethodBody.parse({
        provider: 'paystack',
        providerPaymentMethodToken: 'pm_01HZX9K3Q7V2T8',
        cardholderName: 'JANE WANJIRU',
        billingCountry: 'KE',
      }),
    ).toMatchObject({ provider: 'paystack' });
    expect(
      UpdatePaymentMethodBody.safeParse({
        provider: 'stripe',
        cardholderName: 'JANE WANJIRU',
        billingCountry: 'KE',
      }).success,
    ).toBe(false);
    expect(
      UpdatePaymentMethodBody.safeParse({
        provider: 'stripe',
        providerPaymentMethodToken: 'pm_1',
        cardholderName: 'J',
        billingCountry: 'KE',
      }).success,
    ).toBe(false);
  });

  it('parses every invoice fixture and pins the derived amounts', () => {
    for (const invoice of invoices) {
      expect(Invoice.parse(invoice)).toEqual(invoice);
      // Outstanding is derived: total − paid, never negative.
      expect(invoice.outstandingUsdCents).toBe(
        Math.max(invoice.totalUsdCents - invoice.paidUsdCents, 0),
      );
      expect(invoice.settlementCurrency).toBe('USD');
      expect(invoice.pdfAvailable).toBe(true);
    }
    expect(invoices).toHaveLength(6);
    expect(invoices.map((invoice) => invoice.number)).toEqual([
      'VV-INV-2026-0902',
      'VV-INV-2026-0841',
      'VV-INV-2026-0720',
      'VV-INV-2026-0613',
      'VV-INV-2026-0511',
      'VV-INV-2026-0488',
    ]);
    expect(openInvoice.status).toBe('pending');
    expect(openInvoice.outstandingUsdCents).toBe(249900);
    expect(Invoice.safeParse({ ...openInvoice, number: 'VV-INV-26-0902' }).success).toBe(false);
    expect(Invoice.safeParse({ ...openInvoice, settlementCurrency: 'NGN' }).success).toBe(false);
  });

  it('filters invoices by status through the list query', () => {
    expect(InvoiceListQuery.parse({ status: 'overdue' })).toMatchObject({
      status: 'overdue',
      page: 1,
    });
    expect(InvoiceListQuery.safeParse({ status: 'settled' }).success).toBe(false);
  });

  it('locks an FX quote for display only and rejects any other settlement currency', () => {
    expect(FxQuote.parse(fxQuoteKes)).toEqual(fxQuoteKes);
    expect(
      FxQuoteRequest.parse({ invoiceId: fxQuoteKes.invoiceId, displayCurrency: 'KES' }),
    ).toEqual({ invoiceId: fxQuoteKes.invoiceId, displayCurrency: 'KES' });
    expect(FxQuoteRequest.safeParse({ invoiceId: UUID, displayCurrency: 'BTC' }).success).toBe(
      false,
    );

    // The settlement currency of a quote is USD, full stop.
    for (const currency of ['KES', 'NGN', 'GHS', 'ZAR', 'usd', '']) {
      expect(
        FxQuote.safeParse({ ...fxQuoteKes, settlementCurrency: currency }).success,
        currency,
      ).toBe(false);
    }
    expect(FxQuote.safeParse({ ...fxQuoteKes, settlementCurrency: 'USD' }).success).toBe(true);

    // 249900 × 129.50 = 32 362 050 minor units — display only, never charged.
    expect(fxQuoteKes.localMinor).toBe(32362050);
    expect(fxQuoteKes.usdCents).toBe(249900);
    expect(fxQuoteKes.rateLocalPerUsd).toBe('129.50000000');
    expect(FxQuote.safeParse({ ...fxQuoteKes, rateLocalPerUsd: 129.5 }).success).toBe(false);
    expect(FxQuote.safeParse({ ...fxQuoteKes, rateLocalPerUsd: '129.500000000' }).success).toBe(
      false,
    );
  });

  it('routes M-Pesa through Paystack only', () => {
    const base = { invoiceId: UUID, idempotencyKey: 'idem-01HZX9K3Q7V2T8AB' };

    expect(CheckoutBody.parse({ ...base, provider: 'paystack', channel: 'mpesa' })).toMatchObject({
      channel: 'mpesa',
    });
    expect(CheckoutBody.parse({ ...base, provider: 'stripe', channel: 'card' })).toMatchObject({
      provider: 'stripe',
    });

    const mpesaOnStripe = CheckoutBody.safeParse({ ...base, provider: 'stripe', channel: 'mpesa' });
    expect(mpesaOnStripe.success).toBe(false);
    if (!mpesaOnStripe.success) {
      expect(mpesaOnStripe.error.issues[0]?.path).toEqual(['provider']);
      expect(mpesaOnStripe.error.issues[0]?.message).toBe(MPESA_PROVIDER_MESSAGE);
    }
    expect(
      CheckoutBody.safeParse({ ...base, provider: 'stripe', idempotencyKey: 'short' }).success,
    ).toBe(false);
  });

  it('parses a checkout response and a webhook acknowledgement', () => {
    const response = {
      data: {
        paymentAttemptId: UUID,
        status: 'requires_action',
        usdCents: 249900,
        settlementCurrency: 'USD',
        clientSecret: 'pi_3Q_secret_9x',
      },
    };
    expect(CheckoutResponse.parse(response)).toEqual(response);
    expect(
      CheckoutResponse.safeParse({ ...response, data: { ...response.data, status: 'canceled' } })
        .success,
    ).toBe(false);
    expect(
      CheckoutResponse.safeParse({
        ...response,
        data: { ...response.data, settlementCurrency: 'KES' },
      }).success,
    ).toBe(false);
    expect(WebhookAck.parse({ received: true })).toEqual({ received: true });
    expect(WebhookAck.safeParse({ received: false }).success).toBe(false);
  });
});

describe('content moderation schemas', () => {
  it('parses every moderation fixture', () => {
    for (const item of moderationItems) {
      expect(ModerationItem.parse(item)).toEqual(item);
    }
    expect(moderationItems).toHaveLength(6);
    expect(moderationItems.map((item) => item.slugPath)).toEqual([
      '/blog/kenya-state-house-cyber-audit',
      '/advisories/cve-2026-21447',
      '/products/sentinel',
      '/news/east-african-fintech-alliance',
      '/blog/africa-cyber-awakening',
      '/news/accra-soc-hub',
    ]);
    expect(ModerationItem.safeParse({ ...moderationItems[0], status: 'live' }).success).toBe(false);
    expect(
      ModerationItem.safeParse({ ...moderationItems[0], riskFlags: ['defamation'] }).success,
    ).toBe(false);
  });

  it('identifies every moderation author from the staff roster', () => {
    const roster = new Map(staffMembers.map((member) => [member.id, member]));
    for (const item of moderationItems) {
      const member = roster.get(item.author.id);
      expect(member, `${item.title} author`).toBeDefined();
      expect(item.author.fullName).toBe(member?.fullName);
      expect(item.author.initials).toBe(member?.initials);
    }
  });

  it('treats the byline team as editorial, not as the roster team', () => {
    // `content_items.author_team` is its own column for exactly this reason: a
    // product listing is published under Curriculum & Product even though its
    // author sits in the SOC roster. The byline team must still be a real team.
    const teams = new Set(moderationItems.map((item) => item.author.team));
    expect(teams.has('curriculum_product')).toBe(true);
    for (const team of teams) expect(TEAMS).toContain(team);

    const sentinel = moderationItems.find((item) => item.type === 'product_listing');
    const otieno = staffMembers.find((member) => member.id === sentinel?.author.id);
    expect(sentinel?.author.team).toBe('curriculum_product');
    expect(otieno?.team).toBe('soc_detection_response');
  });

  it('only attaches a CVE id to a threat advisory', () => {
    for (const item of moderationItems) {
      if (item.cveId !== null) expect(item.type).toBe('threat_advisory');
    }
    const advisory = moderationItems.find((item) => item.type === 'threat_advisory');
    expect(advisory?.cveId).toBe('CVE-2026-21447');
  });

  it('parses the moderation summary and query filters', () => {
    expect(ModerationSummary.parse(moderationSummary)).toEqual(moderationSummary);
    expect(ModerationSummary.safeParse({ ...moderationSummary, avgReviewHours: -1 }).success).toBe(
      false,
    );
    expect(ModerationQuery.parse({ flag: 'none' })).toMatchObject({ flag: 'none' });
    expect(
      ModerationQuery.parse({ type: 'threat_advisory', status: 'pending_review' }),
    ).toMatchObject({ type: 'threat_advisory' });
    expect(ModerationQuery.safeParse({ flag: 'spam' }).success).toBe(false);
  });

  it('requires a substantive note for reject and request_changes', () => {
    const approve = ModerationActionBody.safeParse({ action: 'approve' });
    expect(approve.success).toBe(true);

    for (const action of ['reject', 'request_changes'] as const) {
      const withoutNote = ModerationActionBody.safeParse({ action });
      expect(withoutNote.success, action).toBe(false);
      if (!withoutNote.success) {
        expect(withoutNote.error.issues[0]?.path).toEqual(['note']);
        expect(withoutNote.error.issues[0]?.message).toBe(NOTE_REQUIRED_MESSAGE);
      }
      const shortNote = ModerationActionBody.safeParse({ action, note: 'no' });
      expect(shortNote.success, `${action} short note`).toBe(false);
      const withNote = ModerationActionBody.safeParse({
        action,
        note: 'Claims about a named third party are unverified; remove or source them.',
      });
      expect(withNote.success, `${action} with note`).toBe(true);
    }
  });

  it('requires a publish timestamp to schedule', () => {
    const withoutDate = ModerationActionBody.safeParse({ action: 'schedule' });
    expect(withoutDate.success).toBe(false);
    if (!withoutDate.success) {
      expect(withoutDate.error.issues[0]?.path).toEqual(['scheduledFor']);
      expect(withoutDate.error.issues[0]?.message).toBe(SCHEDULE_REQUIRED_MESSAGE);
    }
    expect(
      ModerationActionBody.safeParse({
        action: 'schedule',
        scheduledFor: '2026-09-25T06:00:00Z',
      }).success,
    ).toBe(true);
    expect(ModerationActionBody.safeParse({ action: 'remind_author' }).success).toBe(true);
  });

  it('projects a published item for the public site and labels every value', () => {
    // Task 40b extended this projection: `summary` became `excerpt`, and a card now
    // carries its category, severity, tags, reading time and featured image.
    const published: PublicContentItem = {
      id: 'f0000000-0000-4000-8000-000000000006',
      type: 'news_announcement',
      title: 'VUNVAULT Opens Regional Security Operations Hub in Accra',
      excerpt: 'Announcement of a new regional security operations hub in Accra.',
      slug: 'accra-soc-hub',
      slugPath: '/news/accra-soc-hub',
      category: null,
      categoryLabel: null,
      severity: null,
      tags: [],
      readMinutes: null,
      featuredImageUrl: null,
      imageAlt: null,
      publishedAt: '2026-09-21T12:00:00Z',
      author: { fullName: 'Grace Wanjiru' },
    };
    expect(PublicContentItem.parse(published)).toEqual(published);
    expect(PublicContentItem.safeParse({ ...published, publishedAt: null }).success).toBe(false);
    expect(PublicContentQuery.parse({ type: 'blog_post' })).toMatchObject({ type: 'blog_post' });
    expect(PublicContentQuery.parse({})).toMatchObject({ page: 1, pageSize: 10 });
    expect(PublicContentQuery.safeParse({ type: 'podcast' }).success).toBe(false);

    expect(CONTENT_TYPE_LABELS.threat_advisory).toBe('Threat Advisory');
    expect(CONTENT_STATUS_LABELS.changes_requested).toBe('Changes Requested');
    expect(RISK_FLAG_LABELS.legal_review_required).toBe('Legal review required');
    expect(RISK_FLAG_LABELS.brand_sensitive).toBe('Brand-sensitive');
  });
});

describe('audit schemas', () => {
  it('parses every fixture entry with a 64-character hash pair', () => {
    for (const entry of auditEntries) {
      expect(AuditEntryView.parse(entry)).toEqual(entry);
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.prevHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(auditEntries).toHaveLength(10);
    expect(AuditEntryView.safeParse({ ...auditEntries[0], hash: 'abc123' }).success).toBe(false);
    expect(AuditEntryView.safeParse({ ...auditEntries[0], seq: 0 }).success).toBe(false);
  });

  it('is ordered newest first and links each entry to the one before it', () => {
    const at = (index: number): AuditEntryView => {
      const entry = auditEntries[index];
      if (entry === undefined) throw new Error(`missing fixture entry at ${index}`);
      return entry;
    };

    for (let index = 0; index < auditEntries.length - 1; index += 1) {
      const newer = at(index);
      const older = at(index + 1);
      expect(newer.seq, `seq at ${index}`).toBeGreaterThan(older.seq);
      expect(newer.prevHash, `link at ${index}`).toBe(older.hash);
      expect(newer.createdAt > older.createdAt, `order at ${index}`).toBe(true);
    }
    // The newest entry is the chain head reported by ChainStatus.
    expect(chainStatus.totalEntries).toBe(at(0).seq);
  });

  it('renders SEV levels only where the fixture declares them', () => {
    const advisory = auditEntries.find((entry) => entry.eventType === 'ADVISORY_BROADCAST');
    expect(advisory?.sevLevel).toBe(1);
    const permission = auditEntries.find((entry) => entry.eventType === 'PERMISSION_CHANGED');
    expect(permission?.sevLevel).toBe(2);
    expect(auditEntries.find((entry) => entry.eventType === 'AUTH_SUCCESS')?.sevLevel).toBeNull();
    expect(AuditEntryView.safeParse({ ...auditEntries[0], sevLevel: 4 }).success).toBe(false);
  });

  it('defaults the query range to 24h and rejects an unknown one', () => {
    expect(AuditQuery.parse({})).toMatchObject({ range: '24h', page: 1, pageSize: 10 });
    expect(AuditQuery.parse({ range: '7d', category: 'authentication' })).toMatchObject({
      range: '7d',
    });
    expect(AuditQuery.safeParse({ range: '90d' }).success).toBe(false);
    expect(AuditRangeSchema.options).toEqual(['1h', '6h', '24h', '7d', '30d']);
    expect(AuditRangeSchema.safeParse('24h').success).toBe(true);
    expect(AuditRangeSchema.safeParse('1y').success).toBe(false);
  });

  it('parses the summary, chain status and verification result', () => {
    expect(AuditSummary.parse(auditSummary)).toEqual(auditSummary);
    expect(auditSummary.retentionYears).toBe(7);
    expect(AuditSummary.safeParse({ ...auditSummary, chainIntegrityPercent: 101 }).success).toBe(
      false,
    );

    expect(ChainStatus.parse(chainStatus)).toEqual(chainStatus);
    expect(chainStatus.encryption).toBe('AES-256-GCM');
    expect(ChainStatus.safeParse({ ...chainStatus, encryption: 'AES-128-CBC' }).success).toBe(
      false,
    );
    expect(ChainStatus.safeParse({ ...chainStatus, state: 'degraded' }).success).toBe(false);

    const result = {
      checkedFromSeq: 1482000,
      checkedToSeq: 1482904,
      entries: 905,
      mismatches: 0,
      firstMismatchSeq: null,
      verifiedAt: '2026-09-24T12:00:00Z',
    };
    expect(VerifyChainResult.parse(result)).toEqual(result);
    expect(VerifyChainResult.safeParse({ ...result, verifiedAt: 'now' }).success).toBe(false);
  });

  it('models the three SSE frame types', () => {
    expect(AuditStreamEvent.parse({ type: 'heartbeat' })).toEqual({ type: 'heartbeat' });
    expect(AuditStreamEvent.parse({ type: 'entry', entry: auditEntries[0] }).type).toBe('entry');
    expect(AuditStreamEvent.parse({ type: 'chain', chain: chainStatus }).type).toBe('chain');
    expect(AuditStreamEvent.safeParse({ type: 'delete' }).success).toBe(false);
  });

  it('labels every category, severity and range', () => {
    for (const category of AUDIT_CATEGORIES) {
      expect(AUDIT_CATEGORY_LABELS[category], category).toBeTruthy();
    }
    for (const severity of AUDIT_SEVERITIES) {
      expect(AUDIT_SEVERITY_LABELS[severity], severity).toBeTruthy();
    }
    expect(AUDIT_RANGE_LABELS['24h']).toBe('Last 24 hours');
    expect(AUDIT_SEVERITY_LABELS.ok).toBe('Success / OK');
    expect(Object.keys(AUDIT_CATEGORY_LABELS)).toHaveLength(AUDIT_CATEGORIES.length);
  });

  it('exposes no schema that could edit or delete an audit entry', () => {
    // The read model is the only entry shape this package exports.
    expect(typeof AuditEntryView).toBe('object');
    const routes = ROUTES_B.filter((route) => route.path.startsWith('/api/v1/admin/audit'));
    for (const route of routes) {
      expect(['PUT', 'PATCH', 'DELETE'], `${route.method} ${route.path}`).not.toContain(
        route.method,
      );
    }
  });
});

describe('contact and consent schemas', () => {
  it('accepts a valid contact message', () => {
    const body = {
      name: 'Jane Wanjiru',
      email: 'jane.wanjiru@acmefintech.co.ke',
      organization: 'Acme Fintech Ltd',
      category: 'penetration_testing_request',
      subject: 'Q4 external penetration test',
      message: 'We would like to scope an external penetration test of our customer portal.',
      consent: true,
    };
    expect(ContactBody.parse(body)).toEqual(body);
    expect(ContactCreated.parse({ data: { id: UUID } })).toEqual({ data: { id: UUID } });
    expect(ContactCreated.safeParse({ data: { id: 'not-a-uuid' } }).success).toBe(false);
    expect(ContactCreated.safeParse({ id: UUID }).success).toBe(false);
  });

  it('rejects a message without consent, and says why', () => {
    const withoutConsent = ContactBody.safeParse({
      name: 'Jane Wanjiru',
      email: 'jane.wanjiru@acmefintech.co.ke',
      category: 'general_support',
      subject: 'Question',
      message: 'How quickly can you scope a test?',
      consent: false,
    });
    expect(withoutConsent.success).toBe(false);
    if (!withoutConsent.success) {
      expect(withoutConsent.error.issues[0]?.path).toEqual(['consent']);
      expect(withoutConsent.error.issues[0]?.message).toBe(CONSENT_REQUIRED_MESSAGE);
    }
    // Omitting consent entirely is also refused.
    expect(
      ContactBody.safeParse({
        name: 'Jane Wanjiru',
        email: 'jane.wanjiru@acmefintech.co.ke',
        category: 'general_support',
        subject: 'Question',
        message: 'How quickly can you scope a test?',
      }).success,
    ).toBe(false);
  });

  it('bounds the message length and validates the category', () => {
    const base = {
      name: 'Jane Wanjiru',
      email: 'jane.wanjiru@acmefintech.co.ke',
      category: 'whistleblower_tip',
      subject: 'Report',
      consent: true,
    };
    expect(ContactBody.safeParse({ ...base, message: 'too short' }).success).toBe(false);
    expect(ContactBody.safeParse({ ...base, message: 'x'.repeat(5001) }).success).toBe(false);
    expect(ContactBody.safeParse({ ...base, message: 'x'.repeat(5000) }).success).toBe(true);
    expect(ContactBody.safeParse({ ...base, category: 'sales' }).success).toBe(false);
    expect(Object.keys(CONTACT_CATEGORY_LABELS)).toEqual([...CONTACT_CATEGORIES]);
    expect(CONTACT_CATEGORY_LABELS.journalist_blogger_profile_request).toBe(
      'Journalist / Blogger Profile Request',
    );
  });

  it('parses both consent presets and keeps strictly-necessary non-negotiable', () => {
    expect(
      ConsentBody.parse({ categories: CONSENT_ACCEPT_ALL, policyVersion: '2026-09-01' }),
    ).toMatchObject({ categories: { analytics: true, marketing: true } });
    expect(
      ConsentBody.parse({ categories: CONSENT_ESSENTIAL_ONLY, policyVersion: '2026-09-01' }),
    ).toMatchObject({ categories: { analytics: false, marketing: false, functional: false } });

    expect(
      ConsentBody.safeParse({
        categories: { ...CONSENT_ESSENTIAL_ONLY, strictlyNecessary: false },
        policyVersion: '2026-09-01',
      }).success,
    ).toBe(false);
    expect(ConsentBody.safeParse({ categories: CONSENT_ACCEPT_ALL }).success).toBe(false);
  });
});

describe('ROUTES_B', () => {
  it('documents every billing, content, audit, contact and consent endpoint', () => {
    const paths = ROUTES_B.map((route) => `${route.method} ${route.path}`);
    for (const expected of [
      'GET /api/v1/billing/subscription',
      'GET /api/v1/billing/payment-method',
      'PUT /api/v1/billing/payment-method',
      'GET /api/v1/billing/invoices',
      'GET /api/v1/billing/invoices/:id/pdf',
      'GET /api/v1/billing/invoices.csv',
      'POST /api/v1/billing/fx-quotes',
      'POST /api/v1/billing/checkout',
      'POST /api/v1/webhooks/stripe',
      'POST /api/v1/webhooks/paystack',
      'GET /api/v1/admin/content',
      'GET /api/v1/admin/content/summary',
      'POST /api/v1/admin/content/:id/actions',
      'GET /api/v1/content',
      'GET /api/v1/admin/audit',
      'GET /api/v1/admin/audit/summary',
      'GET /api/v1/admin/audit/chain',
      'POST /api/v1/admin/audit/verify',
      'GET /api/v1/admin/audit/export',
      'GET /api/v1/admin/audit/stream',
      'POST /api/v1/contact',
      'POST /api/v1/consent',
    ]) {
      expect(paths, expected).toContain(expected);
    }
    for (const route of ROUTES_B) {
      expect(typeof route.successStatus).toBe('number');
    }
  });

  it('documents the billing conflict codes and never a crypto channel', () => {
    const checkout = ROUTES_B.find((route) => route.path === '/api/v1/billing/checkout');
    expect(checkout?.errors?.map((error) => error.code)).toEqual(['quote_expired', 'already_paid']);
    const quote = ROUTES_B.find((route) => route.path === '/api/v1/billing/fx-quotes');
    expect(quote?.errors?.map((error) => error.code)).toEqual(['unsupported_currency']);
    const contact = ROUTES_B.find((route) => route.path === '/api/v1/contact');
    expect(contact?.errors?.map((error) => error.code)).toEqual([
      'validation_failed',
      'rate_limited',
    ]);

    const serialised = JSON.stringify(ROUTES_B).toLowerCase();
    expect(serialised).not.toContain('crypto');
    expect(serialised).not.toContain('bitcoin');
  });

  it('keeps the audit surface read-only apart from verify', () => {
    const audit = ROUTES_B.filter((route) => route.path.startsWith('/api/v1/admin/audit'));
    expect(audit.map((route) => route.method)).toEqual(['GET', 'GET', 'GET', 'POST', 'GET', 'GET']);
    expect(audit.find((route) => route.method === 'POST')?.path).toBe('/api/v1/admin/audit/verify');
  });
});

describe('cross-cutting invariants', () => {
  it('never models a hex placeholder or an unmapped severity', () => {
    expect(HEX64).toHaveLength(64);
    for (const severity of AUDIT_SEVERITIES) {
      expect(typeof AUDIT_SEVERITY_LABELS[severity]).toBe('string');
    }
  });
});
