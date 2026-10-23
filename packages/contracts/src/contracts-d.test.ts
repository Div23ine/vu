import { describe, expect, it } from 'vitest';
import { products, publicContent } from '../fixtures/store';
import {
  DownloadUrlResponse,
  EntitlementView,
  LICENSE_KEY_PATTERN,
  NEWSLETTER_COPY,
  NewsletterSubscribeBody,
  NewsletterTokenBody,
  PRODUCT_UNIT_LABELS,
  ProductView,
  PurchaseBody,
  PurchaseResponse,
} from './store';
import {
  PublicContentDetail,
  PublicContentItem,
  PublicContentQuery,
  SEVERITY_CHIP_LABELS,
  SEVERITY_PRIORITY,
} from './content';
import { BLOG_CATEGORY_LABELS } from './studio';
import { ROUTES_D } from './routes-d';

/**
 * Contracts D: the store, the extended public content shapes and the route
 * documentation Task 40c implements.
 *
 * Every schema gets a fixture-backed parse-success test and at least one
 * parse-failure test, which is the rule every earlier contracts task followed: a
 * schema nobody has seen reject anything is a schema nobody trusts.
 */

const PRODUCT_ID = products[0]?.id ?? '';

describe('ProductView', () => {
  it('parses all six catalogue products', () => {
    expect(products).toHaveLength(6);
    for (const product of products) {
      expect(ProductView.parse(product)).toEqual(product);
    }
  });

  it('keeps the verbatim names, prices, units and features', () => {
    expect(products.map((product) => product.slug)).toEqual([
      'reconvault-pro',
      'vulnscope-api',
      'phishguard-kit',
      'loghound-siem-pack',
      'payloadforge',
      'compliancemapper',
    ]);
    expect(products.map((product) => product.priceUsdCents)).toEqual([
      4900, 12_900, 7900, 19_900, 9900, 14_900,
    ]);
    expect(products.map((product) => product.unitLabel)).toEqual([
      'license',
      'year',
      'license',
      'pack',
      'license',
      'year',
    ]);
    for (const product of products) {
      expect(product.features, product.slug).toHaveLength(3);
      expect(product.settlementCurrency, product.slug).toBe('USD');
    }
    expect(products[0]?.description).toBe(
      'Continuous attack-surface enumeration engine with subdomain discovery, port fingerprinting and CVE correlation in a single CLI.',
    );
    expect(products[3]?.features[0]).toBe('412 rules across 14 ATT&CK tactics');
    expect(PRODUCT_UNIT_LABELS).toEqual(['license', 'year', 'pack']);
  });

  it('refuses a non-USD settlement currency and a fractional price', () => {
    expect(ProductView.safeParse({ ...products[0], settlementCurrency: 'KES' }).success).toBe(
      false,
    );
    expect(ProductView.safeParse({ ...products[0], priceUsdCents: 49.5 }).success).toBe(false);
    expect(ProductView.safeParse({ ...products[0], priceUsdCents: -4900 }).success).toBe(false);
    expect(ProductView.safeParse({ ...products[0], unitLabel: 'month' }).success).toBe(false);
  });
});

describe('purchase', () => {
  it('parses a product id and the invoice it produces', () => {
    expect(PurchaseBody.parse({ productId: PRODUCT_ID })).toEqual({ productId: PRODUCT_ID });
    const response = {
      data: {
        invoiceId: 'e1000000-0000-4000-8000-0000000000e1',
        invoiceNumber: 'VV-INV-2026-0844',
        totalUsdCents: 4900,
        settlementCurrency: 'USD',
      },
    };
    expect(PurchaseResponse.parse(response)).toEqual(response);
  });

  it('refuses a bad id and a non-USD settlement', () => {
    expect(PurchaseBody.safeParse({ productId: 'not-a-uuid' }).success).toBe(false);
    expect(
      PurchaseResponse.safeParse({
        data: {
          invoiceId: 'e1000000-0000-4000-8000-0000000000e1',
          invoiceNumber: 'VV-INV-2026-0844',
          totalUsdCents: 4900,
          settlementCurrency: 'NGN',
        },
      }).success,
    ).toBe(false);
  });
});

describe('EntitlementView', () => {
  const entitlement = {
    id: 'd1000000-0000-4000-8000-0000000000d1',
    productId: PRODUCT_ID,
    productName: 'ReconVault Pro',
    licenseKey: 'VV-2B7Q-XK4M-9RTH-3WD6',
    grantedAt: '2026-10-06T09:00:00.000Z',
    updatesUntil: '2027-10-06T09:00:00.000Z',
    downloadable: true,
  };

  it('parses a licence and pins the key format', () => {
    expect(EntitlementView.parse(entitlement)).toEqual(entitlement);
    expect(LICENSE_KEY_PATTERN.test('VV-2B7Q-XK4M-9RTH-3WD6')).toBe(true);
  });

  it('refuses the ambiguous letters and the wrong shape', () => {
    for (const key of [
      'VV-ILIO-ILIO-ILIO-ILIO',
      'VV-2B7Q-XK4M-9RTH',
      'vv-2b7q-xk4m-9rth-3wd6',
      'XX-2B7Q-XK4M-9RTH-3WD6',
      'VV-2B7QXK4M9RTH3WD6',
    ]) {
      expect(LICENSE_KEY_PATTERN.test(key), key).toBe(false);
      expect(EntitlementView.safeParse({ ...entitlement, licenseKey: key }).success, key).toBe(
        false,
      );
    }
  });

  it('parses a download URL response', () => {
    const response = {
      data: {
        url: 'https://assets.vunvault.test/store/reconvault-pro.zip?sig=1',
        expiresAt: '2026-10-06T09:05:00.000Z',
      },
    };
    expect(DownloadUrlResponse.parse(response)).toEqual(response);
    expect(DownloadUrlResponse.safeParse({ data: { url: 'not-a-url' } }).success).toBe(false);
  });
});

describe('newsletter contracts', () => {
  it('parses a signup with and without a source', () => {
    expect(
      NewsletterSubscribeBody.parse({ email: 'analyst@example.test', source: 'blog' }),
    ).toEqual({ email: 'analyst@example.test', source: 'blog' });
    expect(NewsletterSubscribeBody.parse({ email: 'analyst@example.test' })).toEqual({
      email: 'analyst@example.test',
    });
  });

  it('refuses a bad address, a long source and a short token', () => {
    expect(NewsletterSubscribeBody.safeParse({ email: 'nope' }).success).toBe(false);
    expect(
      NewsletterSubscribeBody.safeParse({ email: 'a@b.co', source: 'x'.repeat(41) }).success,
    ).toBe(false);
    expect(NewsletterTokenBody.safeParse({ token: 'short' }).success).toBe(false);
    expect(NewsletterTokenBody.parse({ token: 't'.repeat(20) })).toEqual({
      token: 't'.repeat(20),
    });
  });

  it('carries the verbatim copy', () => {
    expect(NEWSLETTER_COPY).toEqual({
      eyebrow: 'Threat Advisory Newsletter',
      title: 'Get zero-day briefings before the exploit drops.',
      fine: 'No spam. Unsubscribe anytime. We only send threat intelligence.',
    });
  });
});

describe('the extended public content shapes', () => {
  it('parses every fixture item', () => {
    expect(publicContent).toHaveLength(6);
    for (const item of publicContent) {
      expect(PublicContentItem.parse(item)).toEqual(item);
    }
  });

  it('keeps the prototype’s titles, excerpts, authors, dates, reading times and severities', () => {
    expect(publicContent.map((item) => item.title)).toEqual([
      'Kenya State House Cyber Security Audit & Risk Analysis',
      "Africa's Cyber Awakening: How the Continent Is Fighting Back",
      'Cybersecurity Compliance Frameworks for SACCOs & Fintechs',
      'Zero-Day Exploit Trends: What 2026 Revealed About API Ingress',
      'Ransomware Playbooks Now Targeting East African SACCOs',
      'Inside the VUNVAULT Sensor Network: Catching Memory Exfiltration',
    ]);
    expect(publicContent.map((item) => item.author.fullName)).toEqual([
      'VUNVAULT Threat Desk',
      'Fatima Hassan',
      'Brian Otieno',
      'Fatima Hassan',
      'Amara Njoroge',
      'Daniel Mwangi',
    ]);
    expect(publicContent.map((item) => item.severity)).toEqual([
      'high',
      'medium',
      'medium',
      'critical',
      'high',
      'low',
    ]);
    expect(publicContent.map((item) => item.readMinutes)).toEqual([7, 6, 8, 5, 9, 6]);
    expect(publicContent.map((item) => item.publishedAt.slice(0, 10))).toEqual([
      '2026-08-14',
      '2026-08-11',
      '2026-08-08',
      '2026-08-05',
      '2026-08-02',
      '2026-07-29',
    ]);
    expect(publicContent[0]?.excerpt).toBe(
      'An investigative analysis of government digital perimeter vulnerabilities and defence protocols.',
    );
  });

  it('maps prototype categories onto the Studio enum and its labels', () => {
    expect(publicContent.map((item) => item.category)).toEqual([
      'news',
      'industry_updates',
      'industry_updates',
      'threat_intel',
      'news',
      'blog',
    ]);
    for (const item of publicContent) {
      expect(item.categoryLabel, item.slug).toBe(
        item.category === null ? null : BLOG_CATEGORY_LABELS[item.category],
      );
    }
  });

  it('derives the slug from the slug path', () => {
    for (const item of publicContent) {
      expect(item.slugPath.endsWith(`/${item.slug}`), item.slug).toBe(true);
      expect(item.slugPath.startsWith('/blog/'), item.slug).toBe(true);
    }
  });

  it('exposes an author name and nothing else about them', () => {
    const serialised = JSON.stringify(publicContent);
    expect(serialised).not.toContain('@');
    expect(serialised).not.toContain('authorId');
    expect(Object.keys(publicContent[0]?.author ?? {})).toEqual(['fullName']);
  });

  it('refuses a card with no slug, an unknown category or a bad severity', () => {
    expect(PublicContentItem.safeParse({ ...publicContent[0], slug: '' }).success).toBe(false);
    expect(PublicContentItem.safeParse({ ...publicContent[0], category: 'podcast' }).success).toBe(
      false,
    );
    expect(PublicContentItem.safeParse({ ...publicContent[0], severity: 'urgent' }).success).toBe(
      false,
    );
    // The old Task 20 shape is gone: `summary` is `excerpt`.
    const first = publicContent[0] as PublicContentItem;
    const { excerpt: _excerpt, ...withoutExcerpt } = first;
    expect(PublicContentItem.safeParse(withoutExcerpt).success).toBe(false);
  });

  it('extends to the detail route with a Markdown body', () => {
    const detail = { ...publicContent[0], bodyMd: '## Findings\n\nSanitised markdown.' };
    expect(PublicContentDetail.parse(detail)).toEqual(detail);
    expect(PublicContentDetail.safeParse(publicContent[0]).success).toBe(false);
  });

  it('filters and sorts the feed', () => {
    const unsorted = PublicContentQuery.parse({ page: 1, pageSize: 9 });
    expect(unsorted.sort).toBeUndefined();
    expect(unsorted.q).toBeUndefined();
    expect(
      PublicContentQuery.parse({
        page: 1,
        pageSize: 9,
        type: 'blog_post',
        category: 'threat_intel',
        severity: 'critical',
        sort: 'priority',
      }),
    ).toMatchObject({ sort: 'priority', severity: 'critical' });
    expect(PublicContentQuery.safeParse({ page: 1, pageSize: 9, sort: 'oldest' }).success).toBe(
      false,
    );
  });

  it('labels and ranks severities for the priority sort', () => {
    expect(SEVERITY_CHIP_LABELS).toEqual({
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    });
    expect(SEVERITY_PRIORITY.critical).toBeLessThan(SEVERITY_PRIORITY.high);
    expect(SEVERITY_PRIORITY.high).toBeLessThan(SEVERITY_PRIORITY.medium);
    expect(SEVERITY_PRIORITY.medium).toBeLessThan(SEVERITY_PRIORITY.low);
  });
});

describe('ROUTES_D', () => {
  it('documents the ten Task 40c endpoints', () => {
    expect(ROUTES_D.slice(0, 10).map((route) => `${route.method} ${route.path}`)).toEqual([
      'GET /api/v1/content',
      'GET /api/v1/content/:slug',
      'GET /api/v1/products',
      'GET /api/v1/products/:slug',
      'POST /api/v1/products/:id/purchase',
      'GET /api/v1/entitlements',
      'POST /api/v1/entitlements/:id/download-url',
      'POST /api/v1/newsletter',
      'POST /api/v1/newsletter/confirm',
      'POST /api/v1/newsletter/unsubscribe',
    ]);
  });

  it('documents the six Task 40g internal scan-callback endpoints', () => {
    expect(ROUTES_D).toHaveLength(16);
    expect(ROUTES_D.slice(10).map((route) => `${route.method} ${route.path}`)).toEqual([
      'POST /api/v1/internal/scans/:id/claim',
      'POST /api/v1/internal/scans/:id/progress',
      'POST /api/v1/internal/scans/:id/findings',
      'POST /api/v1/internal/scans/:id/log-url',
      'POST /api/v1/internal/scans/:id/complete',
      'POST /api/v1/internal/scans/:id/fail',
    ]);
    // No session permission names them: the HMAC signature is the identity.
    for (const route of ROUTES_D.slice(10)) {
      expect(route.permission).toBeUndefined();
      expect(route.notes).toContain('HMAC-signed');
    }
  });

  it('names a permission for the two routes that need one, and no more', () => {
    const guarded = ROUTES_D.filter((route) => route.permission !== undefined);
    expect(guarded.map((route) => route.path)).toEqual(['/api/v1/products/:id/purchase']);
    expect(guarded[0]?.permission).toBe('billing:manage');
  });

  it('documents the status codes the UI branches on', () => {
    const newsletter = ROUTES_D.find((route) => route.path === '/api/v1/newsletter');
    expect(newsletter?.successStatus).toBe(202);
    const confirm = ROUTES_D.find((route) => route.path === '/api/v1/newsletter/confirm');
    expect(confirm?.successStatus).toBe(204);
    expect(confirm?.errors).toEqual([{ status: 404, code: 'not_found' }]);
    const download = ROUTES_D.find(
      (route) => route.path === '/api/v1/entitlements/:id/download-url',
    );
    expect(download?.errors?.map((error) => error.code)).toEqual(['not_found', 'not_available']);
  });

  it('has no crypto payment route and no write to the public feed', () => {
    const serialised = JSON.stringify(ROUTES_D).toLowerCase();
    for (const forbidden of ['crypto', 'bitcoin', 'usdt', 'mpesa', 'wallet']) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
    // Content is written through the Studio and moderation routes, never here.
    expect(
      ROUTES_D.some((route) => route.path.startsWith('/api/v1/content') && route.method !== 'GET'),
    ).toBe(false);
  });
});
