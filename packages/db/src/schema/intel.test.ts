import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  advisories,
  advisoryAcknowledgements,
  advisoryBroadcasts,
  clientAssets,
  endpointStats,
  platformMetricsHourly,
  sensorNodes,
  threatLevelSnapshots,
} from './intel.js';
import { invoices, paymentAttempts, plans, invoiceLines } from './billing.js';
import { organizations } from './identity.js';
import { scanJobs } from './scans.js';
import {
  ADVISORY_PATCH_STATUSES,
  ADVISORY_STATUSES,
  BROADCAST_KINDS,
  NODE_STATUSES,
  SCOPE_CATEGORIES,
} from '../enum-values.js';

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sql');
const addendumSql = readFileSync(join(sqlDir, '0020_intel_and_txn.sql'), 'utf8');

/** `generatedIdentity` is a runtime field Drizzle does not expose in its types. */
interface IdentityColumn {
  generatedIdentity?: { type?: string; sequenceOptions?: { startWith?: number } };
}

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

const TABLES = [
  ['advisories', advisories],
  ['advisory_broadcasts', advisoryBroadcasts],
  ['advisory_acknowledgements', advisoryAcknowledgements],
  ['client_assets', clientAssets],
  ['sensor_nodes', sensorNodes],
  ['platform_metrics_hourly', platformMetricsHourly],
  ['endpoint_stats', endpointStats],
  ['threat_level_snapshots', threatLevelSnapshots],
] as const;

describe('intel tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});

describe('advisories', () => {
  it('declares the zero-day desk columns', () => {
    expect(columnNames(advisories)).toEqual([
      'id',
      'cve_id',
      'vendor',
      'cvss',
      'disclosure_date',
      'severity',
      'weaponized',
      'public_poc',
      'pre_auth',
      'patch_available',
      'title',
      'summary',
      'remediation',
      'references',
      'scope',
      'status',
      'patch_status',
      'author_id',
      'content_item_id',
      'last_saved_at',
      'published_at',
      'retracted_at',
      'retraction_note',
      'created_at',
      'updated_at',
    ]);
  });

  it('enforces the CVE id format, the CVSS band and the copy limits', () => {
    expect(checkNames(advisories)).toEqual([
      'advisories_cve_id_format',
      'advisories_cvss_range',
      'advisories_severity_matches_cvss',
      'advisories_summary_length',
      'advisories_remediation_length',
    ]);
    const cve = getTableConfig(advisories).checks.find(
      (constraint) => constraint.name === 'advisories_cve_id_format',
    );
    expect(cve).toBeDefined();
    expect(columnOf(advisories, 'cve_id').isUnique).toBe(true);
    expect(columnOf(advisories, 'title').getSQLType()).toBe('varchar(140)');
  });

  it('keeps title nullable in the database — the API requires it before publishing', () => {
    expect(columnOf(advisories, 'title').notNull).toBe(false);
    expect(columnOf(advisories, 'status').notNull).toBe(true);
  });

  it('indexes the desk views, including a partial index on weaponized', () => {
    const indexes = getTableConfig(advisories).indexes;
    expect(indexes.map((idx) => idx.config.name)).toEqual([
      'advisories_status_published_idx',
      'advisories_severity_idx',
      'advisories_author_status_idx',
      'advisories_weaponized_idx',
    ]);
    const weaponized = indexes.find((idx) => idx.config.name === 'advisories_weaponized_idx');
    expect(weaponized?.config.where).toBeDefined();
  });
});

describe('advisory_broadcasts', () => {
  it('records the acknowledgement, the audience and the delivery counters', () => {
    expect(columnNames(advisoryBroadcasts)).toEqual([
      'id',
      'advisory_id',
      'kind',
      'status',
      'triggered_by',
      'ack',
      'audience_dashboards',
      'email_contacts',
      'sms_contacts',
      'sent_dashboards',
      'sent_email',
      'sent_sms',
      'failed',
      'audit_seq',
      'queue_job_id',
      'started_at',
      'finished_at',
      'created_at',
    ]);
    expect(getTableConfig(advisoryBroadcasts).indexes.map((idx) => idx.config.name)).toEqual([
      'advisory_broadcasts_advisory_created_idx',
    ]);
  });

  it('is append-only except for delivery progress', () => {
    expect(addendumSql).toContain('BEFORE DELETE ON advisory_broadcasts');
    expect(addendumSql).toContain('BEFORE UPDATE ON advisory_broadcasts');
    expect(addendumSql).toContain("RAISE EXCEPTION 'advisory broadcasts are append-only'");
    for (const mutable of [
      'status',
      'sent_dashboards',
      'sent_email',
      'sent_sms',
      'failed',
      'finished_at',
      'started_at',
      'queue_job_id',
      'audit_seq',
    ]) {
      expect(addendumSql, `${mutable} must stay mutable`).toContain(`'${mutable}'`);
    }
    // Anything outside the allow-list is compared, so a rewrite is refused.
    expect(addendumSql).toContain('to_jsonb(OLD)');
    expect(addendumSql).toContain('IS DISTINCT FROM');
  });
});

describe('advisory_acknowledgements', () => {
  it('counts one acknowledgement per organisation per advisory', () => {
    expect(columnNames(advisoryAcknowledgements)).toEqual([
      'id',
      'advisory_id',
      'org_id',
      'user_id',
      'acknowledged_at',
    ]);
    const unique = getTableConfig(advisoryAcknowledgements).indexes.find(
      (idx) => idx.config.name === 'advisory_acknowledgements_advisory_org_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(2);
  });
});

describe('client_assets', () => {
  it('maps a client estate onto scope categories', () => {
    expect(columnNames(clientAssets)).toEqual([
      'id',
      'org_id',
      'category',
      'product',
      'version',
      'host',
      'created_at',
    ]);
    expect(getTableConfig(clientAssets).indexes.map((idx) => idx.config.name)).toEqual([
      'client_assets_org_id_idx',
      'client_assets_category_idx',
    ]);
  });
});

describe('sensor_nodes', () => {
  it('tracks heartbeat health and holds a signing key', () => {
    expect(columnNames(sensorNodes)).toEqual([
      'id',
      'code',
      'label',
      'country',
      'status',
      'req_per_min',
      'load_percent',
      'heartbeat_latency_ms',
      'clock_drift_ms',
      'missed_heartbeats',
      'last_heartbeat_at',
      'public_key',
      'created_at',
      'updated_at',
    ]);
    expect(columnOf(sensorNodes, 'code').isUnique).toBe(true);
    expect(columnOf(sensorNodes, 'public_key').notNull).toBe(true);
    expect(checkNames(sensorNodes)).toContain('sensor_nodes_load_range');
  });
});

describe('Command Center metrics', () => {
  it('keys the hourly rollup on the hour', () => {
    expect(columnNames(platformMetricsHourly)).toEqual([
      'hour',
      'site_sessions',
      'api_requests',
      'avg_response_ms',
      'p95_response_ms',
      'threats_blocked',
    ]);
    expect(columnOf(platformMetricsHourly, 'hour').primary).toBe(true);
  });

  it('stores per-endpoint windows uniquely', () => {
    expect(columnNames(endpointStats)).toEqual([
      'id',
      'endpoint',
      'window_start',
      'requests',
      'avg_latency_ms',
      'error_ratio',
    ]);
    const unique = getTableConfig(endpointStats).indexes.find(
      (idx) => idx.config.name === 'endpoint_stats_endpoint_window_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(columnOf(endpointStats, 'error_ratio').getSQLType()).toBe('numeric(6, 4)');
  });

  it('bounds the threat level to 1..5', () => {
    expect(columnNames(threatLevelSnapshots)).toEqual([
      'id',
      'computed_at',
      'level',
      'active_zero_days',
      'critical_cves',
      'unpatched_critical',
      'weaponized_in_wild',
      'threats_blocked_ytd',
    ]);
    expect(checkNames(threatLevelSnapshots)).toContain('threat_level_snapshots_level_range');
  });
});

describe('Task 20b column additions', () => {
  it('gives payment attempts a human transaction code', () => {
    expect(columnNames(paymentAttempts).slice(0, 5)).toEqual([
      'id',
      'txn_number',
      'txn_code',
      'invoice_id',
      'fx_quote_id',
    ]);
    const txnCode = columnOf(paymentAttempts, 'txn_code');
    expect(txnCode.generated?.type).toBe('always');
    expect(txnCode.isUnique).toBe(true);
    const identity = columnOf(paymentAttempts, 'txn_number') as unknown as IdentityColumn;
    expect(identity.generatedIdentity?.type).toBe('always');
    expect(identity.generatedIdentity?.sequenceOptions?.startWith).toBe(90242);
    expect(addendumSql).toContain('START WITH 90242');
    expect(addendumSql).toContain("'VX-' || txn_number::text");
  });

  it('stores provider customer handles on the organisation', () => {
    expect(columnNames(organizations)).toContain('stripe_customer_id');
    expect(columnNames(organizations)).toContain('paystack_customer_code');
    expect(columnOf(organizations, 'stripe_customer_id').isUnique).toBe(true);
    expect(columnOf(organizations, 'paystack_customer_code').isUnique).toBe(true);
  });

  it('prices a plan per unit', () => {
    expect(columnNames(plans)).toEqual([
      'id',
      'code',
      'name',
      'description',
      'unit',
      'monthly_usd_cents',
      'active',
      'created_at',
    ]);
    expect(String(columnOf(plans, 'unit').default)).toContain('month');
    expect(addendumSql).toMatch(/'starter_scan'.*'Starter Scan'.*'scan'.*29900/s);
    expect(addendumSql).toMatch(/'sacco_fintech_compliance'.*'assessment'.*89900/s);
    expect(addendumSql).toMatch(/'enterprise_retainer'.*'Enterprise Client'.*'month'.*249900/s);
  });

  it('links an invoice line to a plan code', () => {
    expect(columnNames(invoiceLines)).toEqual([
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
    expect(getTableConfig(invoiceLines).foreignKeys.map((key) => key.getName())).toContain(
      'invoice_lines_plan_code_plans_code_fk',
    );
  });

  it('records the analyst running a scan job', () => {
    expect(columnNames(scanJobs)).toContain('analyst_id');
    expect(getTableConfig(scanJobs).indexes.map((idx) => idx.config.name)).toContain(
      'scan_jobs_analyst_id_idx',
    );
  });

  it('seeds the plan catalogue and the chart of accounts idempotently', () => {
    expect(addendumSql).toContain('ON CONFLICT (code) DO NOTHING');
    for (const plan of ['starter_scan', 'sacco_fintech_compliance', 'enterprise_retainer']) {
      expect(addendumSql, plan).toContain(plan);
    }
    for (const account of [
      'accounts_receivable',
      'cash_stripe_clearing',
      'cash_paystack_clearing',
      'revenue_services',
      'revenue_subscription',
      'revenue_academy',
      'refunds',
      'deferred_revenue',
    ]) {
      expect(addendumSql, account).toContain(account);
    }
    expect(invoices).toBeDefined();
  });
});

describe('Task 20b enums', () => {
  it('adds the five new value sets', () => {
    expect(ADVISORY_STATUSES).toEqual(['draft', 'published', 'retracted']);
    expect(ADVISORY_PATCH_STATUSES).toEqual(['unpatched', 'patch_in_progress', 'patched']);
    expect(SCOPE_CATEGORIES).toEqual([
      'web_api',
      'network_edge',
      'endpoint_desktop',
      'cloud_containers',
      'mobile',
      'ot_ics',
      'identity_sso',
    ]);
    expect(BROADCAST_KINDS).toEqual(['initial', 'rebroadcast', 'retraction']);
    expect(NODE_STATUSES).toEqual([
      'operational',
      'high_load',
      'drift_warning',
      'degraded',
      'offline',
    ]);
  });
});
