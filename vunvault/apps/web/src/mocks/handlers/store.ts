import { http, HttpResponse } from 'msw';
import {
  EntitlementView,
  ProductView,
  type EntitlementView as EntitlementViewType,
  type ProductView as ProductViewType,
} from '@vunvault/contracts';
import { products } from '@vunvault/contracts/fixtures/store';
import { formatInvoiceNumber } from '@vunvault/lib';

/**
 * Store mock handlers (Tasks 55 + 73).
 *
 *   GET  /api/v1/products             → 200 { data: ProductView[]; total }
 *   POST /api/v1/products/:id/purchase → 201 PurchaseResponse | 404
 *   GET  /api/v1/entitlements         → 200 { data: EntitlementView[] }
 *   POST /api/v1/entitlements/:id/download-url
 *                                     → 200 { data: { url; expiresAt } } | 404 | 409 not_available
 *
 * The catalogue fixture IS the seeded product table (six licences, USD
 * cents, `settlementCurrency: "USD"`); every list response is validated
 * against the contract schema so fixture drift fails loudly. Purchases issue
 * a deterministic invoice (`VV-INV-<year>-<000n>` via the shared formatter) —
 * payment itself is Task 66's checkout, never this handler.
 *
 * Task 73 adds the client's entitlements: a deterministic three-row seed
 * (schema-checked with `EntitlementView.parse`) covering the active window,
 * an EXPIRED window and a licence whose product archive is not published
 * (`downloadable: false` → the 409 `not_available` path). Download URLs are
 * presigned-style CDN links — the app never proxies bytes.
 */

let issued = 0;

export const entitlementSeed: EntitlementViewType[] = [
  EntitlementView.parse({
    id: 'e4000000-0000-4000-8000-000000000001',
    productId: 'a1000000-0000-4000-8000-000000000001',
    productName: 'ReconVault Pro',
    licenseKey: 'VV-K7M2-9QRT-4XJB-8NPD',
    grantedAt: '2026-01-15T10:00:00.000Z',
    updatesUntil: '2027-01-15T10:00:00.000Z',
    downloadable: true,
  }),
  EntitlementView.parse({
    id: 'e4000000-0000-4000-8000-000000000002',
    productId: 'a1000000-0000-4000-8000-000000000003',
    productName: 'PhishGuard Kit',
    licenseKey: 'VV-T3VW-6HYK-2MCP-7RQD',
    grantedAt: '2024-11-02T09:30:00.000Z',
    updatesUntil: '2025-11-02T09:30:00.000Z',
    downloadable: true,
  }),
  EntitlementView.parse({
    id: 'e4000000-0000-4000-8000-000000000003',
    productId: 'a1000000-0000-4000-8000-000000000005',
    productName: 'PayloadForge',
    licenseKey: 'VV-B9NF-4KJT-8WQM-3XRC',
    grantedAt: '2026-09-30T12:00:00.000Z',
    updatesUntil: '2027-09-30T12:00:00.000Z',
    downloadable: false,
  }),
];

function downloadSlug(productName: string): string {
  return productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function assertFixture(product: ProductViewType): void {
  const parsed = ProductView.safeParse(product);
  if (!parsed.success) {
    throw new Error(`products fixture drifted from ProductView: ${parsed.error.message}`);
  }
}

export const storeHandlers = [
  http.get('*/api/v1/products', () => {
    for (const product of products) assertFixture(product);
    return HttpResponse.json({ data: products, total: products.length });
  }),

  http.post('*/api/v1/products/:id/purchase', ({ params }) => {
    const id = String(params.id);
    const product = products.find((candidate) => candidate.id === id);
    if (product === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    issued += 1;
    const year = new Date().getUTCFullYear();
    return HttpResponse.json(
      {
        data: {
          invoiceId: `b1000000-0000-4000-8000-${String(issued).padStart(12, '0')}`,
          invoiceNumber: formatInvoiceNumber(year, issued),
          totalUsdCents: product.priceUsdCents,
          settlementCurrency: 'USD',
        },
      },
      { status: 201 },
    );
  }),

  http.get('*/api/v1/entitlements', () => HttpResponse.json({ data: entitlementSeed })),

  http.post('*/api/v1/entitlements/:id/download-url', ({ params }) => {
    const id = String(params.id);
    const entitlement = entitlementSeed.find((candidate) => candidate.id === id);
    if (entitlement === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!entitlement.downloadable) {
      return HttpResponse.json({ error: 'not_available' }, { status: 409 });
    }
    return HttpResponse.json({
      data: {
        url: `https://cdn.vunvault.test/downloads/${downloadSlug(entitlement.productName)}.zip?sig=mock-${entitlement.id.slice(-4)}`,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    });
  }),
];
