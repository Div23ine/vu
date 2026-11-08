import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAtCol, idCol, timestamps, tz } from './_columns.js';
import {
  uampAiInvestigationStatusEnum,
  uampAlertChannelEnum,
  uampCheckResultStatusEnum,
  uampHttpMethodEnum,
  uampIncidentSeverityEnum,
  uampIncidentStatusEnum,
  uampMonitorStatusEnum,
  uampMonitorTypeEnum,
  uampStatusPageVisibilityEnum,
} from './_enums.js';
import { organizations, profiles } from './identity.js';

/**
 * UAMP — AI-powered uptime & API monitoring product module.
 *
 * Tenant isolation: every table is org-scoped via `org_id` → `organizations`.
 * RLS is enabled with no permissive policies (API uses the server role).
 *
 * Monitoring must operate independently of the AI layer.
 * Frontend product surface: https://uptimehq.vunvault.com
 */

export interface UampResponseAssertion {
  expectedStatusCodes?: number[];
  bodyContains?: string;
  jsonPath?: string;
  jsonEquals?: unknown;
  maxLatencyMs?: number;
}

export interface UampHeader {
  name: string;
  value: string;
}

export const uampMonitors = pgTable(
  'uamp_monitors',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    createdBy: uuid('created_by').references(() => profiles.id),
    name: text('name').notNull(),
    type: uampMonitorTypeEnum('type').notNull(),
    status: uampMonitorStatusEnum('status').notNull().default('active'),
    target: text('target').notNull(),
    method: uampHttpMethodEnum('method').default('GET'),
    intervalSeconds: integer('interval_seconds').notNull().default(300),
    timeoutMs: integer('timeout_ms').notNull().default(10_000),
    locations: text('locations')
      .array()
      .notNull()
      .default(sql`'{}'`),
    headers: jsonb('headers').$type<UampHeader[]>().notNull().default([]),
    requestBody: text('request_body'),
    assertions: jsonb('assertions').$type<UampResponseAssertion>(),
    keyword: text('keyword'),
    warnDaysBeforeExpiry: smallint('warn_days_before_expiry'),
    lastStatus: uampCheckResultStatusEnum('last_status'),
    lastCheckedAt: tz('last_checked_at'),
    lastLatencyMs: integer('last_latency_ms'),
    deletedAt: tz('deleted_at'),
    ...timestamps,
  },
  (table) => [
    index('uamp_monitors_org_status_idx').on(table.orgId, table.status),
    index('uamp_monitors_org_type_idx').on(table.orgId, table.type),
    index('uamp_monitors_next_check_idx').on(table.status, table.lastCheckedAt),
    check(
      'uamp_monitors_interval_positive',
      sql`${table.intervalSeconds} >= 30 AND ${table.intervalSeconds} <= 86400`,
    ),
    check(
      'uamp_monitors_timeout_positive',
      sql`${table.timeoutMs} >= 1000 AND ${table.timeoutMs} <= 60000`,
    ),
    check('uamp_monitors_name_length', sql`char_length(${table.name}) BETWEEN 1 AND 120`),
    check('uamp_monitors_target_length', sql`char_length(${table.target}) BETWEEN 1 AND 2048`),
  ],
).enableRLS();

export const uampCheckResults = pgTable(
  'uamp_check_results',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => uampMonitors.id, { onDelete: 'cascade' }),
    status: uampCheckResultStatusEnum('status').notNull(),
    httpStatus: integer('http_status'),
    latencyMs: integer('latency_ms'),
    location: text('location'),
    errorMessage: text('error_message'),
    responseSnippet: text('response_snippet'),
    checkedAt: tz('checked_at').notNull().defaultNow(),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('uamp_check_results_monitor_checked_idx').on(
      table.monitorId,
      sql`${table.checkedAt} DESC`,
    ),
    index('uamp_check_results_org_checked_idx').on(table.orgId, sql`${table.checkedAt} DESC`),
    check(
      'uamp_check_results_snippet_length',
      sql`${table.responseSnippet} IS NULL OR char_length(${table.responseSnippet}) <= 2048`,
    ),
    check(
      'uamp_check_results_error_length',
      sql`${table.errorMessage} IS NULL OR char_length(${table.errorMessage}) <= 500`,
    ),
  ],
).enableRLS();

export const uampIncidents = pgTable(
  'uamp_incidents',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => uampMonitors.id, { onDelete: 'cascade' }),
    status: uampIncidentStatusEnum('status').notNull().default('open'),
    severity: uampIncidentSeverityEnum('severity').notNull().default('major'),
    title: text('title').notNull(),
    summary: text('summary'),
    startedAt: tz('started_at').notNull().defaultNow(),
    acknowledgedAt: tz('acknowledged_at'),
    resolvedAt: tz('resolved_at'),
    acknowledgedBy: uuid('acknowledged_by').references(() => profiles.id),
    resolvedBy: uuid('resolved_by').references(() => profiles.id),
    failureCount: integer('failure_count').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index('uamp_incidents_org_status_idx').on(table.orgId, table.status),
    index('uamp_incidents_monitor_started_idx').on(table.monitorId, sql`${table.startedAt} DESC`),
    check('uamp_incidents_title_length', sql`char_length(${table.title}) BETWEEN 1 AND 200`),
  ],
).enableRLS();

export const uampStatusPages = pgTable(
  'uamp_status_pages',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    visibility: uampStatusPageVisibilityEnum('visibility').notNull().default('public'),
    customDomain: text('custom_domain'),
    monitorIds: uuid('monitor_ids')
      .array()
      .notNull()
      .default(sql`'{}'`),
    headline: text('headline'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uamp_status_pages_org_slug_idx').on(table.orgId, table.slug),
    index('uamp_status_pages_org_idx').on(table.orgId),
    check('uamp_status_pages_name_length', sql`char_length(${table.name}) BETWEEN 1 AND 120`),
    check(
      'uamp_status_pages_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'`,
    ),
  ],
).enableRLS();

export const uampAlertRules = pgTable(
  'uamp_alert_rules',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    monitorId: uuid('monitor_id').references(() => uampMonitors.id, { onDelete: 'cascade' }),
    channel: uampAlertChannelEnum('channel').notNull(),
    destination: text('destination').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    failureThreshold: smallint('failure_threshold').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index('uamp_alert_rules_org_monitor_idx').on(table.orgId, table.monitorId),
    check(
      'uamp_alert_rules_threshold_positive',
      sql`${table.failureThreshold} >= 1 AND ${table.failureThreshold} <= 20`,
    ),
    check(
      'uamp_alert_rules_destination_length',
      sql`char_length(${table.destination}) BETWEEN 1 AND 2048`,
    ),
  ],
).enableRLS();

export const uampAiInvestigations = pgTable(
  'uamp_ai_investigations',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => uampIncidents.id, { onDelete: 'cascade' }),
    status: uampAiInvestigationStatusEnum('status').notNull().default('queued'),
    model: text('model'),
    report: text('report'),
    findings: jsonb('findings'),
    errorMessage: text('error_message'),
    startedAt: tz('started_at'),
    completedAt: tz('completed_at'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('uamp_ai_investigations_incident_idx').on(table.incidentId),
    index('uamp_ai_investigations_org_status_idx').on(table.orgId, table.status),
  ],
).enableRLS();

export const uampApiKeys = pgTable(
  'uamp_api_keys',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    createdBy: uuid('created_by').references(() => profiles.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`'{}'`),
    lastUsedAt: tz('last_used_at'),
    revokedAt: tz('revoked_at'),
    expiresAt: tz('expires_at'),
    createdAt: createdAtCol(),
  },
  (table) => [
    uniqueIndex('uamp_api_keys_key_hash_idx').on(table.keyHash),
    index('uamp_api_keys_org_idx').on(table.orgId),
    check('uamp_api_keys_name_length', sql`char_length(${table.name}) BETWEEN 1 AND 80`),
  ],
).enableRLS();
