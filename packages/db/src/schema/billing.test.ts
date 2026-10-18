import { is } from 'drizzle-orm';
import { getTableConfig, getViewConfig, PgTable, type AnyPgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './index.js';
import {
  fxQuotes,
  invoiceBalances,
  invoiceLines,
  invoices,
  journalEntries,
  ledgerAccounts,
  ledgerLines,
  paymentAttempts,
  paymentMethods,
  plans,
  providerWebhookEvents,
  subscriptions,
} from './billing.js';

/** Every table declared anywhere in the schema, keyed by its SQL name. */
function allTables(): Array<[string, AnyPgTable]> {
  const tables: Array<[string, AnyPgTable]> = [];
  for (const value of Object.values(schema) as unknown[]) {
    if (!is(value, PgTable)) continue;
    const table = value as AnyPgTable;
    tables.push([getTableConfig(table).name, table]);
  }
  return tables.sort((a, b) => a[0].localeCompare(b[0]));
}

const BILLING_TABLES = [
  ['plans', plans],
  ['subscriptions', subscriptions],
  ['payment_methods', paymentMethods],
  ['ledger_accounts', ledgerAccounts],
  ['journal_entries', journalEntries],
  ['ledger_lines', ledgerLines],
  ['invoices', invoices],
  ['invoice_lines', invoiceLines],
  ['fx_quotes', fxQuotes],
  ['payment_attempts', paymentAttempts],
  ['provider_webhook_events', providerWebhookEvents],
] as const;

describe('billing tables', () => {
  it.each(BILLING_TABLES)('%s exists with RLS enabled', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });

  it('never stores a card number, PAN or CVC anywhere in the schema', () => {
    const forbidden = new Set(['card_number', 'pan', 'cvc', 'cvv', 'card_number_encrypted']);
    for (const [tableName, table] of allTables()) {
      for (const columnName of getTableConfig(table).columns.map((column) => column.name)) {
        expect(forbidden.has(columnName), `${tableName}.${columnName}`).toBe(false);
      }
    }
    // Tokenised card data only: brand, last four and expiry.
    const cardColumns = getTableConfig(paymentMethods).columns.map((column) => column.name);
    expect(cardColumns).toContain('provider_payment_method_id');
    expect(cardColumns).toContain('brand');
    expect(cardColumns).toContain('last4');
    expect(cardColumns).toContain('exp_month');
    expect(cardColumns).toContain('exp_year');
  });

  it('settles every monetary table in USD', () => {
    for (const [tableName, table] of allTables()) {
      for (const column of getTableConfig(table).columns) {
        if (column.name !== 'settlement_currency') continue;
        expect(column.notNull, `${tableName}.settlement_currency`).toBe(true);
        expect(String(column.default), `${tableName}.settlement_currency`).toContain('USD');
        const usdCheck = getTableConfig(table).checks.find((constraint) =>
          constraint.name.endsWith('_settlement_usd'),
        );
        expect(usdCheck, `${tableName} must pin settlement_currency to USD`).toBeDefined();
      }
    }
  });

  it('stores amounts as integer USD cents, never floats', () => {
    for (const [tableName, table] of allTables()) {
      for (const column of getTableConfig(table).columns) {
        if (!column.name.endsWith('_usd_cents')) continue;
        expect(column.dataType, `${tableName}.${column.name}`).toBe('number');
        // A `bigint` column in `number` mode — never a float type.
        expect(column.columnType, `${tableName}.${column.name}`).toMatch(/^PgBigInt/);
      }
    }
  });

  it('keeps local currency confined to fx_quotes', () => {
    for (const [tableName, table] of allTables()) {
      for (const column of getTableConfig(table).columns) {
        if (column.name !== 'display_currency' && column.name !== 'local_minor') continue;
        expect(tableName).toBe('fx_quotes');
      }
    }
    expect(getTableConfig(fxQuotes).indexes.map((idx) => idx.config.name)).toEqual([
      'fx_quotes_invoice_currency_idx',
    ]);
  });
});

describe('double-entry ledger', () => {
  it('declares the entry and line columns', () => {
    expect(getTableConfig(journalEntries).columns.map((column) => column.name)).toEqual([
      'id',
      'org_id',
      'kind',
      'memo',
      'occurred_at',
      'reference_type',
      'reference_id',
      'idempotency_key',
      'reverses_entry_id',
      'created_by',
      'created_at',
    ]);
    expect(getTableConfig(ledgerLines).columns.map((column) => column.name)).toEqual([
      'id',
      'entry_id',
      'account_id',
      'direction',
      'amount_usd_cents',
      'created_at',
    ]);
  });

  it('rejects a non-positive line amount', () => {
    const check = getTableConfig(ledgerLines).checks.find(
      (constraint) => constraint.name === 'ledger_lines_amount_positive',
    );
    expect(check).toBeDefined();
  });

  it('makes webhook handling idempotent per provider event', () => {
    const unique = getTableConfig(providerWebhookEvents).indexes.find(
      (idx) => idx.config.name === 'provider_webhook_events_provider_event_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(2);
  });

  it('derives invoice balances from a view the ORM does not own', () => {
    const config = getViewConfig(invoiceBalances);
    expect(config.name).toBe('invoice_balances');
    // `.existing()` — the DDL lives in sql/0017_ledger_constraints.sql.
    expect(config.isExisting).toBe(true);
    expect(config.query).toBeUndefined();
    const viewColumns = Object.values(config.selectedFields).map(
      (column) => (column as { name: string }).name,
    );
    expect(viewColumns).toEqual([
      'invoice_id',
      'total_usd_cents',
      'paid_usd_cents',
      'outstanding_usd_cents',
    ]);
  });

  it('never stores a mutable amount-paid column on an invoice', () => {
    const invoiceColumns = getTableConfig(invoices).columns.map((column) => column.name);
    expect(invoiceColumns).not.toContain('amount_paid');
    expect(invoiceColumns).not.toContain('paid_usd_cents');
    expect(invoiceColumns).not.toContain('total_usd_cents');
    expect(invoiceColumns).toContain('number');
    expect(invoiceColumns).toContain('settlement_currency');
  });

  it('totals invoices from their lines', () => {
    const columns = getTableConfig(invoiceLines).columns.map((column) => column.name);
    expect(columns).toEqual([
      'id',
      'invoice_id',
      'description',
      'plan_code',
      // Task 40b: a store purchase links its line to the product it sells.
      'product_id',
      'quantity',
      'unit_usd_cents',
      'ledger_entry_id',
    ]);
    const checks = getTableConfig(invoiceLines).checks.map((constraint) => constraint.name);
    expect(checks).toContain('invoice_lines_quantity_positive');
    expect(checks).toContain('invoice_lines_unit_non_negative');
  });

  it('charges a payment attempt in USD even when an FX quote is attached', () => {
    const columns = getTableConfig(paymentAttempts).columns.map((column) => column.name);
    expect(columns).toContain('fx_quote_id');
    expect(columns).toContain('usd_cents');
    expect(columns).toContain('settlement_currency');
    expect(columns).toContain('idempotency_key');
    const checks = getTableConfig(paymentAttempts).checks.map((constraint) => constraint.name);
    expect(checks).toContain('payment_attempts_amount_positive');
    expect(checks).toContain('payment_attempts_settlement_usd');
  });

  it('pins the subscription renewal date and plan', () => {
    const columns = getTableConfig(subscriptions).columns.map((column) => column.name);
    expect(columns).toEqual([
      'id',
      'org_id',
      'plan_id',
      'status',
      'billing_cycle',
      'amount_usd_cents',
      'settlement_currency',
      'renews_on',
      'provider',
      'provider_subscription_id',
      'canceled_at',
      'created_at',
      'updated_at',
    ]);
    expect(getTableConfig(plans).columns.map((column) => column.name)).toEqual([
      'id',
      'code',
      'name',
      'description',
      'unit',
      'monthly_usd_cents',
      'active',
      'created_at',
    ]);
    expect(getTableConfig(ledgerAccounts).columns.map((column) => column.name)).toEqual([
      'id',
      'code',
      'name',
      'type',
      'created_at',
    ]);
  });
});
