import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  LICENSE_KEY_PATTERN,
  newsletterSubscribers,
  productEntitlements,
  products,
  PRODUCT_UNIT_LABELS,
} from './store';
import { contentItems } from './content';
import { invoiceLines } from './billing';
import { NEWSLETTER_STATUSES } from '../enum-values';

/**
 * The public store's schema (Task 40b).
 *
 * Three things are worth asserting beyond "the columns exist": every table is RLS
 * enabled with no permissive policy, the licence key is pinned to the published
 * format by a database check as well as by the generator, and no plaintext secret
 * is stored — the newsletter token is a hash, and the one bearer credential in this
 * schema (a licence key) is the product being delivered.
 */

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function columnOf(table: Parameters<typeof getTableConfig>[0], name: string) {
  const found = getTableConfig(table).columns.find((column) => column.name === name);
  if (found === undefined) throw new Error(`column ${name} is missing`);
  return found;
}

function checkNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).checks.map((constraint) => constraint.name);
}

function indexNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).indexes.map((constraint) => constraint.config.name ?? '');
}

const TABLES = [
  ['products', products],
  ['product_entitlements', productEntitlements],
  ['newsletter_subscribers', newsletterSubscribers],
] as const;

describe('store tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });

  it('models the catalogue exactly', () => {
    expect(columnNames(products)).toEqual([
      'id',
      'slug',
      'name',
      'category',
      'description',
      'features',
      'price_usd_cents',
      'unit_label',
      'active',
      'delivery_object_key',
      'sort_order',
      'created_at',
      'updated_at',
    ]);
    expect(columnNames(productEntitlements)).toEqual([
      'id',
      'org_id',
      'product_id',
      'invoice_id',
      'license_key',
      'granted_at',
      'updates_until',
      'revoked_at',
    ]);
    expect(columnNames(newsletterSubscribers)).toEqual([
      'id',
      'email',
      'status',
      'token_hash',
      'source',
      'ip_hash',
      'confirmed_at',
      'unsubscribed_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('prices in positive integer USD cents and nothing else', () => {
    const price = columnOf(products, 'price_usd_cents');
    // `usdCents()` is `bigint(..., { mode: 'number' })`: a bigint column read as a
    // JS number, exact up to 2^53 cents.
    expect(price.columnType).toBe('PgBigInt53');
    expect(price.notNull).toBe(true);
    expect(checkNames(products)).toContain('products_price_positive');
    // There is no local-currency column anywhere in the store.
    expect(columnNames(products).join(',')).not.toContain('local');
    expect(columnNames(products).join(',')).not.toContain('currency');
  });

  it('allows exactly the three unit labels', () => {
    expect(PRODUCT_UNIT_LABELS).toEqual(['license', 'year', 'pack']);
    expect(checkNames(products)).toContain('products_unit_label_allowed');
  });

  it('makes granting a licence idempotent per org, product and invoice', () => {
    expect(indexNames(productEntitlements)).toContain(
      'product_entitlements_org_product_invoice_idx',
    );
    const unique = getTableConfig(productEntitlements).indexes.find(
      (constraint) => constraint.config.name === 'product_entitlements_org_product_invoice_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(indexNames(productEntitlements)).toContain('product_entitlements_org_id_idx');
  });

  it('pins the licence key format in the database, not only in the generator', () => {
    expect(checkNames(productEntitlements)).toContain('product_entitlements_license_key_format');
    expect(columnOf(productEntitlements, 'license_key').notNull).toBe(true);
    // The published shape: VV- plus four groups of four Crockford base32 characters.
    expect(LICENSE_KEY_PATTERN).toBe('^VV-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$');
    const pattern = new RegExp(LICENSE_KEY_PATTERN);
    expect(pattern.test('VV-2B7Q-XK4M-9RTH-3WD6')).toBe(true);
    // Crockford drops I, L, O and U so a key cannot be misread over the phone.
    expect(pattern.test('VV-ILIO-ILIO-ILIO-ILIO')).toBe(false);
    expect(pattern.test('VV-2B7Q-XK4M-9RTH')).toBe(false);
  });

  it('requires the update window to outlast the grant', () => {
    expect(checkNames(productEntitlements)).toContain('product_entitlements_updates_after_grant');
  });

  it('stores the newsletter token as a hash and the IP as a daily-salted hash', () => {
    expect(columnOf(newsletterSubscribers, 'token_hash').notNull).toBe(true);
    expect(columnNames(newsletterSubscribers)).not.toContain('token');
    expect(columnNames(newsletterSubscribers)).not.toContain('ip');
    expect(columnNames(newsletterSubscribers)).toContain('ip_hash');
    expect(NEWSLETTER_STATUSES).toEqual(['pending', 'confirmed', 'unsubscribed']);
    expect(columnOf(newsletterSubscribers, 'status').notNull).toBe(true);
    // citext + unique: one row per address, whatever capitalisation arrives.
    expect(columnOf(newsletterSubscribers, 'email').notNull).toBe(true);
  });
});

describe('the two columns added to earlier tables', () => {
  it('gives content items a severity and the feed its priority index', () => {
    expect(columnNames(contentItems)).toContain('severity');
    expect(columnOf(contentItems, 'severity').notNull).toBe(false);
    expect(indexNames(contentItems)).toContain('content_items_type_severity_published_idx');
  });

  it('links an invoice line to the product it sells', () => {
    expect(columnNames(invoiceLines)).toContain('product_id');
    expect(columnOf(invoiceLines, 'product_id').notNull).toBe(false);
  });
});

describe('the product seed', () => {
  const sql = readFileSync(new URL('../../sql/0040_products_seed.sql', import.meta.url), 'utf8');

  it('is idempotent by slug', () => {
    expect(sql).toContain('ON CONFLICT (slug) DO NOTHING');
    expect(sql).not.toMatch(/ON CONFLICT[^(]*DO UPDATE/i);
  });

  it('seeds the six products with their verbatim prices and units', () => {
    for (const [slug, cents, unit] of [
      ['reconvault-pro', 4900, 'license'],
      ['vulnscope-api', 12900, 'year'],
      ['phishguard-kit', 7900, 'license'],
      ['loghound-siem-pack', 19900, 'pack'],
      ['payloadforge', 9900, 'license'],
      ['compliancemapper', 14900, 'year'],
    ] as Array<[string, number, string]>) {
      expect(sql, slug).toContain(`'${slug}'`);
      expect(sql, `${slug} price`).toContain(`${cents}, '${unit}'`);
    }
  });

  it('sorts them 1 to 6 and leaves the delivery key for an operator', () => {
    for (const order of [1, 2, 3, 4, 5, 6]) {
      expect(sql).toContain(`, ${order}\n  )`);
    }
    expect(sql.match(/NULL, \d/g) ?? []).toHaveLength(6);
  });

  it('keeps the verbatim copy', () => {
    expect(sql).toContain('ReconVault Pro');
    expect(sql).toContain('CT-log & DNS brute subdomain enumeration');
    expect(sql).toContain('412 rules across 14 ATT&CK tactics');
    expect(sql).toContain('CBK / ISO 27001 / GDPR control mapping');
    expect(sql).toContain(
      'Headless vulnerability scanner exposed as a REST API — drop authenticated scans straight into your CI/CD or SOC automation.',
    );
  });
});
