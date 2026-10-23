import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { citext, createdAtCol, idCol, timestamps, tz, usdCents } from './_columns';
import {
  billingCycleEnum,
  displayCurrencyEnum,
  invoiceStatusEnum,
  journalKindEnum,
  ledgerAccountTypeEnum,
  ledgerDirectionEnum,
  paymentAttemptStatusEnum,
  paymentChannelEnum,
  paymentProviderEnum,
  subscriptionStatusEnum,
} from './_enums';
import { organizations, profiles } from './identity';
import { scanJobs } from './scans';
// Circular by design: `store.ts` points entitlements at an invoice, and an invoice
// line points at a product. Both references are inside lambdas, so neither module
// dereferences the other while it is being evaluated.
import { products } from './store';

/**
 * Money rules — non-negotiable:
 *
 * 1. **Settlement currency is USD, always.** Amounts are integer USD cents
 *    (`usdCents`). Local currencies (`KES`, `NGN`, `GHS`, `ZAR`) are display-only
 *    and appear ONLY in `fx_quotes`.
 * 2. **The ledger is the source of truth.** An invoice's total / paid /
 *    outstanding are derived from ledger lines through the `invoice_balances`
 *    view. Invoices never store a mutable "amount paid".
 * 3. **Never store card numbers.** Only provider tokens, brand, last four digits
 *    and expiry. The browser tokenises the card with the provider; the API never
 *    sees raw card data.
 * 4. **No cryptocurrency anywhere.**
 *
 * Immutability of `journal_entries` and `ledger_lines`, the double-entry balance
 * assertion and the `invoice_balances` view itself are enforced in
 * `sql/0017_ledger_constraints.sql`.
 */

/** First human transaction code issued by the platform was `VX-90241`. */
const TXN_NUMBER_START = 90242;

/**
 * Ledger account codes. Seeding is not part of this schema:
 *   accounts_receivable    (asset)      cash_stripe_clearing   (asset)
 *   cash_paystack_clearing (asset)      revenue_services       (revenue)
 *   revenue_subscription   (revenue)    revenue_academy        (revenue)
 *   refunds                (expense)    deferred_revenue       (liability)
 */

export const plans = pgTable('plans', {
  id: idCol(),
  /** e.g. `enterprise_retainer`. */
  code: text('code').notNull().unique(),
  /** e.g. `Enterprise Client`. */
  name: text('name').notNull(),
  description: text('description'),
  /**
   * Pricing unit: `scan` | `assessment` | `month`. `monthlyUsdCents` holds the
   * unit price in USD cents whatever the unit is — the column name is historical,
   * the value is always "price per `unit`, in USD cents".
   */
  unit: text('unit').notNull().default('month'),
  monthlyUsdCents: usdCents('monthly_usd_cents').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAtCol(),
}).enableRLS();

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum('status').notNull(),
    billingCycle: billingCycleEnum('billing_cycle').notNull(),
    amountUsdCents: usdCents('amount_usd_cents').notNull(),
    settlementCurrency: char('settlement_currency', { length: 3 }).notNull().default('USD'),
    renewsOn: date('renews_on').notNull(),
    provider: paymentProviderEnum('provider'),
    providerSubscriptionId: text('provider_subscription_id'),
    canceledAt: tz('canceled_at'),
    ...timestamps,
  },
  (table) => [
    index('subscriptions_org_id_idx').on(table.orgId),
    check('subscriptions_settlement_usd', sql`${table.settlementCurrency} = 'USD'`),
  ],
).enableRLS();

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    provider: paymentProviderEnum('provider').notNull(),
    /** Provider-side token. The PAN never reaches this database. */
    providerPaymentMethodId: text('provider_payment_method_id').notNull(),
    /** e.g. `Mastercard`. */
    brand: text('brand').notNull(),
    last4: char('last4', { length: 4 }).notNull(),
    expMonth: smallint('exp_month').notNull(),
    expYear: smallint('exp_year').notNull(),
    cardholderName: text('cardholder_name'),
    billingCountry: char('billing_country', { length: 2 }),
    isDefault: boolean('is_default').notNull().default(true),
    createdAt: createdAtCol(),
  },
  (table) => [
    uniqueIndex('payment_methods_provider_pm_idx').on(
      table.provider,
      table.providerPaymentMethodId,
    ),
    check('payment_methods_exp_month_range', sql`${table.expMonth} BETWEEN 1 AND 12`),
  ],
).enableRLS();

export const ledgerAccounts = pgTable('ledger_accounts', {
  id: idCol(),
  /** e.g. `accounts_receivable`. */
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: ledgerAccountTypeEnum('type').notNull(),
  createdAt: createdAtCol(),
}).enableRLS();

/** Immutable double-entry header. Corrections are reversal entries. */
export const journalEntries = pgTable('journal_entries', {
  id: idCol(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  kind: journalKindEnum('kind').notNull(),
  memo: text('memo'),
  occurredAt: tz('occurred_at').notNull().defaultNow(),
  /** `invoice` | `payment_attempt`. */
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  reversesEntryId: uuid('reverses_entry_id'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: createdAtCol(),
}).enableRLS();

/** Immutable double-entry lines. Debits must equal credits per entry. */
export const ledgerLines = pgTable(
  'ledger_lines',
  {
    id: idCol(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => journalEntries.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    direction: ledgerDirectionEnum('direction').notNull(),
    amountUsdCents: usdCents('amount_usd_cents').notNull(),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('ledger_lines_entry_id_idx').on(table.entryId),
    index('ledger_lines_account_id_idx').on(table.accountId),
    check('ledger_lines_amount_positive', sql`${table.amountUsdCents} > 0`),
  ],
).enableRLS();

/**
 * Presentation record only. The amounts a client sees come from
 * `invoice_balances`, never from a column on this table.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: idCol(),
    /** e.g. `VV-INV-2026-0841`. */
    number: text('number').notNull().unique(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    status: invoiceStatusEnum('status').notNull().default('pending'),
    issuedAt: tz('issued_at').notNull(),
    dueAt: tz('due_at'),
    /** e.g. `Full Scope API PenTest`. */
    title: text('title').notNull(),
    /** e.g. `Enterprise Retainer · 12 endpoints · retest included`. */
    detail: text('detail'),
    settlementCurrency: char('settlement_currency', { length: 3 }).notNull().default('USD'),
    pdfObjectKey: text('pdf_object_key'),
    scanJobId: uuid('scan_job_id').references(() => scanJobs.id),
    ...timestamps,
  },
  (table) => [
    index('invoices_org_issued_idx').on(table.orgId, sql`${table.issuedAt} DESC`),
    check('invoices_settlement_usd', sql`${table.settlementCurrency} = 'USD'`),
  ],
).enableRLS();

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: idCol(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    /** Plan this line bills against, when it is a subscription line. */
    planCode: text('plan_code').references(() => plans.code),
    /** Product this line sells, when it is a store purchase (Task 40b). */
    productId: uuid('product_id').references(() => products.id),
    quantity: integer('quantity').notNull().default(1),
    unitUsdCents: usdCents('unit_usd_cents').notNull(),
    /** The `invoice_issued` entry that recognised this line's revenue. */
    ledgerEntryId: uuid('ledger_entry_id').references(() => journalEntries.id),
  },
  (table) => [
    index('invoice_lines_invoice_id_idx').on(table.invoiceId),
    check('invoice_lines_quantity_positive', sql`${table.quantity} > 0`),
    check('invoice_lines_unit_non_negative', sql`${table.unitUsdCents} >= 0`),
  ],
).enableRLS();

/** Display-only locked rate. The charge that follows is always `usd_cents` in USD. */
export const fxQuotes = pgTable(
  'fx_quotes',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    displayCurrency: displayCurrencyEnum('display_currency').notNull(),
    /** Local major units per 1 USD, as a decimal string with eight places. */
    rateLocalPerUsd: numeric('rate_local_per_usd', { precision: 18, scale: 8 }).notNull(),
    usdCents: usdCents('usd_cents').notNull(),
    localMinor: bigint('local_minor', { mode: 'number' }).notNull(),
    lockedAt: tz('locked_at').notNull().defaultNow(),
    /** The API sets `locked_at + 15 minutes`. */
    expiresAt: tz('expires_at').notNull(),
    consumedAt: tz('consumed_at'),
  },
  (table) => [index('fx_quotes_invoice_currency_idx').on(table.invoiceId, table.displayCurrency)],
).enableRLS();

/**
 * A payment attempt always charges `usd_cents` in USD — even when `fx_quote_id`
 * is set. The quote only changes what the customer *sees*.
 */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: idCol(),
    /** Human transaction code, e.g. `VX-90241`. Derived, stored, never inserted. */
    txnNumber: bigint('txn_number', { mode: 'number' })
      .notNull()
      .generatedAlwaysAsIdentity({ startWith: TXN_NUMBER_START }),
    txnCode: text('txn_code')
      .notNull()
      .unique()
      .generatedAlwaysAs(sql`'VX-' || txn_number::text`),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    fxQuoteId: uuid('fx_quote_id').references(() => fxQuotes.id),
    provider: paymentProviderEnum('provider').notNull(),
    channel: paymentChannelEnum('channel').notNull(),
    providerReference: text('provider_reference'),
    status: paymentAttemptStatusEnum('status').notNull().default('created'),
    usdCents: usdCents('usd_cents').notNull(),
    settlementCurrency: char('settlement_currency', { length: 3 }).notNull().default('USD'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    failureCode: text('failure_code'),
    createdBy: uuid('created_by').references(() => profiles.id),
    ...timestamps,
  },
  (table) => [
    index('payment_attempts_invoice_idx').on(table.invoiceId),
    check('payment_attempts_amount_positive', sql`${table.usdCents} > 0`),
    check('payment_attempts_settlement_usd', sql`${table.settlementCurrency} = 'USD'`),
  ],
).enableRLS();

/** Idempotent webhook handling: one row per provider event id. */
export const providerWebhookEvents = pgTable(
  'provider_webhook_events',
  {
    id: idCol(),
    provider: paymentProviderEnum('provider').notNull(),
    eventId: text('event_id').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: tz('received_at').notNull().defaultNow(),
    processedAt: tz('processed_at'),
  },
  (table) => [
    uniqueIndex('provider_webhook_events_provider_event_idx').on(table.provider, table.eventId),
  ],
).enableRLS();

/**
 * Derived balances. The view itself is created in
 * `sql/0017_ledger_constraints.sql`; `.existing()` tells Drizzle it owns no DDL.
 */
export const invoiceBalances = pgView('invoice_balances', {
  invoiceId: uuid('invoice_id').notNull(),
  totalUsdCents: bigint('total_usd_cents', { mode: 'number' }).notNull(),
  paidUsdCents: bigint('paid_usd_cents', { mode: 'number' }).notNull(),
  outstandingUsdCents: bigint('outstanding_usd_cents', { mode: 'number' }).notNull(),
}).existing();

/**
 * Guest (no-account) orders created from the public /pricing checkout.
 * `reference` is the Paystack transaction reference handed over at
 * initialise — one source of truth, unique, idempotent fulfilment.
 * Settlement is always USD; the display conversion is a locked snapshot.
 */
export const guestOrders = pgTable(
  'guest_orders',
  {
    id: idCol(),
    reference: text('reference').notNull().unique(),
    planCode: text('plan_code').notNull(),
    email: citext('email').notNull(),
    status: text('status').notNull().default('pending'),
    usdCents: integer('usd_cents').notNull(),
    displayCurrency: displayCurrencyEnum('display_currency').notNull().default('USD'),
    rateLocalPerUsd: text('rate_local_per_usd'),
    displayMinor: bigint('display_minor', { mode: 'number' }),
    paidAt: tz('paid_at'),
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (table) => [
    index('guest_orders_email_idx').on(table.email),
    index('guest_orders_status_idx').on(table.status),
  ],
).enableRLS();
