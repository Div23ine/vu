import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAtCol, idCol, timestamps, tz } from './_columns';
import {
  advisoryPatchStatusEnum,
  advisoryStatusEnum,
  broadcastKindEnum,
  broadcastStatusEnum,
  findingSeverityEnum,
  nodeStatusEnum,
  scopeCategoryEnum,
} from './_enums';
import { organizations, profiles } from './identity';
import { contentItems } from './content';

/**
 * Zero-Day Intel desk, sensor fleet and Command Center dashboard data.
 *
 * Heartbeat rule (enforced by the maintenance worker, Layer L11): a signed
 * heartbeat every 15 s; 2 consecutive misses → `degraded`; 3 → `offline`. The
 * threat level is recalculated hourly; level ≥ 4 escalates to the incident
 * commander on duty.
 *
 * `advisory_broadcasts` is append-only for everything except delivery progress —
 * `sql/0020_intel_and_txn.sql` blocks DELETE outright and blocks UPDATE of any
 * column outside the allowed list.
 */

/** One line of an advisory's "who is affected" scope list. */
export interface AdvisoryScopeEntry {
  label: string;
  category: ScopeCategoryOrNull;
}

type ScopeCategoryOrNull =
  | 'web_api'
  | 'network_edge'
  | 'endpoint_desktop'
  | 'cloud_containers'
  | 'mobile'
  | 'ot_ics'
  | 'identity_sso'
  | null;

/** The five-point acknowledgement every `initial` / `rebroadcast` needs. */
export interface AdvisoryBroadcastAck {
  severityCorrect: boolean;
  scopeComplete: boolean;
  contentSafe: boolean;
  remediationActionable: boolean;
  authorised: boolean;
}

/**
 * CVSS → severity bands. Both columns are nullable (a draft may carry only one),
 * but when both are present they must agree.
 */
const SEVERITY_MATCHES_CVSS = sql`(
  advisories.cvss IS NULL
  OR advisories.severity IS NULL
  OR (advisories.severity = 'critical' AND advisories.cvss BETWEEN 9.0 AND 10.0)
  OR (advisories.severity = 'high'     AND advisories.cvss BETWEEN 7.0 AND 8.9)
  OR (advisories.severity = 'medium'   AND advisories.cvss BETWEEN 4.0 AND 6.9)
  OR (advisories.severity = 'low'      AND advisories.cvss BETWEEN 0.1 AND 3.9)
)`;

export const advisories = pgTable(
  'advisories',
  {
    id: idCol(),
    cveId: text('cve_id').notNull().unique(),
    vendor: text('vendor'),
    cvss: numeric('cvss', { precision: 3, scale: 1 }),
    disclosureDate: date('disclosure_date'),
    severity: findingSeverityEnum('severity'),
    weaponized: boolean('weaponized').notNull().default(false),
    publicPoc: boolean('public_poc').notNull().default(false),
    preAuth: boolean('pre_auth').notNull().default(false),
    patchAvailable: boolean('patch_available').notNull().default(false),
    /** Required before publishing — enforced by the API, not by a NOT NULL here. */
    title: varchar('title', { length: 140 }),
    summary: text('summary'),
    remediation: text('remediation'),
    references: text('references')
      .array()
      .notNull()
      .default(sql`'{}'`),
    scope: jsonb('scope').$type<AdvisoryScopeEntry[]>().notNull().default([]),
    status: advisoryStatusEnum('status').notNull().default('draft'),
    patchStatus: advisoryPatchStatusEnum('patch_status').notNull().default('unpatched'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id),
    /** Set when the advisory is mirrored into the moderation queue. */
    contentItemId: uuid('content_item_id').references(() => contentItems.id),
    lastSavedAt: tz('last_saved_at'),
    publishedAt: tz('published_at'),
    retractedAt: tz('retracted_at'),
    retractionNote: text('retraction_note'),
    ...timestamps,
  },
  (table) => [
    index('advisories_status_published_idx').on(table.status, sql`${table.publishedAt} DESC`),
    index('advisories_severity_idx').on(table.severity),
    index('advisories_author_status_idx').on(table.authorId, table.status),
    index('advisories_weaponized_idx')
      .on(table.weaponized)
      .where(sql`${table.weaponized} = true`),
    check('advisories_cve_id_format', sql`${table.cveId} ~ '^CVE-\\d{4}-\\d{4,}$'`),
    check('advisories_cvss_range', sql`${table.cvss} IS NULL OR ${table.cvss} BETWEEN 0 AND 10`),
    check('advisories_severity_matches_cvss', SEVERITY_MATCHES_CVSS),
    check(
      'advisories_summary_length',
      sql`${table.summary} IS NULL OR char_length(${table.summary}) <= 1200`,
    ),
    check(
      'advisories_remediation_length',
      sql`${table.remediation} IS NULL OR char_length(${table.remediation}) <= 900`,
    ),
  ],
).enableRLS();

/**
 * One row per broadcast attempt. Delivery counters and the terminal status may be
 * updated; nothing else may change, and no row may be deleted.
 */
export const advisoryBroadcasts = pgTable(
  'advisory_broadcasts',
  {
    id: idCol(),
    advisoryId: uuid('advisory_id')
      .notNull()
      .references(() => advisories.id),
    kind: broadcastKindEnum('kind').notNull(),
    status: broadcastStatusEnum('status').notNull().default('queued'),
    triggeredBy: uuid('triggered_by')
      .notNull()
      .references(() => profiles.id),
    /** All five must be true for `initial` and `rebroadcast`. */
    ack: jsonb('ack').$type<AdvisoryBroadcastAck>().notNull(),
    audienceDashboards: integer('audience_dashboards').notNull().default(0),
    emailContacts: integer('email_contacts').notNull().default(0),
    smsContacts: integer('sms_contacts').notNull().default(0),
    sentDashboards: integer('sent_dashboards').notNull().default(0),
    sentEmail: integer('sent_email').notNull().default(0),
    sentSms: integer('sent_sms').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    /** Chain height of the SEV-1 audit entry written for this broadcast. */
    auditSeq: bigint('audit_seq', { mode: 'number' }),
    queueJobId: text('queue_job_id'),
    startedAt: tz('started_at'),
    finishedAt: tz('finished_at'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('advisory_broadcasts_advisory_created_idx').on(
      table.advisoryId,
      sql`${table.createdAt} DESC`,
    ),
  ],
).enableRLS();

/** "Reach" = distinct organisations that acknowledged within 24 h of first broadcast. */
export const advisoryAcknowledgements = pgTable(
  'advisory_acknowledgements',
  {
    id: idCol(),
    advisoryId: uuid('advisory_id')
      .notNull()
      .references(() => advisories.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id').references(() => profiles.id),
    acknowledgedAt: tz('acknowledged_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('advisory_acknowledgements_advisory_org_idx').on(table.advisoryId, table.orgId),
  ],
).enableRLS();

/** Client estate, used to match advisory scope entries to affected organisations. */
export const clientAssets = pgTable(
  'client_assets',
  {
    id: idCol(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    category: scopeCategoryEnum('category').notNull(),
    product: text('product').notNull(),
    version: text('version'),
    host: text('host'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('client_assets_org_id_idx').on(table.orgId),
    index('client_assets_category_idx').on(table.category),
  ],
).enableRLS();

/** Sensor fleet. Nodes sign their heartbeats with `public_key` (Ed25519, base64). */
export const sensorNodes = pgTable(
  'sensor_nodes',
  {
    id: idCol(),
    /** e.g. `node-nbo-01`. */
    code: text('code').notNull().unique(),
    /** e.g. `Nairobi Core`. */
    label: text('label').notNull(),
    /** e.g. `Kenya`. */
    country: text('country').notNull(),
    status: nodeStatusEnum('status').notNull().default('operational'),
    reqPerMin: integer('req_per_min').notNull().default(0),
    loadPercent: smallint('load_percent').notNull().default(0),
    heartbeatLatencyMs: integer('heartbeat_latency_ms'),
    clockDriftMs: integer('clock_drift_ms'),
    missedHeartbeats: smallint('missed_heartbeats').notNull().default(0),
    lastHeartbeatAt: tz('last_heartbeat_at'),
    publicKey: text('public_key').notNull(),
    ...timestamps,
  },
  (table) => [
    index('sensor_nodes_status_idx').on(table.status),
    check(
      'sensor_nodes_load_range',
      sql`${table.loadPercent} >= 0 AND ${table.loadPercent} <= 100`,
    ),
  ],
).enableRLS();

/** Hourly rollup behind the Command Center traffic chart. */
export const platformMetricsHourly = pgTable('platform_metrics_hourly', {
  hour: tz('hour').primaryKey(),
  siteSessions: integer('site_sessions').notNull().default(0),
  apiRequests: bigint('api_requests', { mode: 'number' }).notNull().default(0),
  avgResponseMs: integer('avg_response_ms').notNull().default(0),
  p95ResponseMs: integer('p95_response_ms').notNull().default(0),
  threatsBlocked: integer('threats_blocked').notNull().default(0),
}).enableRLS();

/** Per-endpoint latency and error-ratio windows. */
export const endpointStats = pgTable(
  'endpoint_stats',
  {
    id: idCol(),
    /** e.g. `/api/v1/scan/submit`. */
    endpoint: text('endpoint').notNull(),
    windowStart: tz('window_start').notNull(),
    requests: bigint('requests', { mode: 'number' }).notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
    /** `0.0021` renders as 0.21 %. */
    errorRatio: numeric('error_ratio', { precision: 6, scale: 4 }).notNull().default('0'),
  },
  (table) => [
    uniqueIndex('endpoint_stats_endpoint_window_idx').on(table.endpoint, table.windowStart),
  ],
).enableRLS();

/** Hourly threat-level history; level 1–5. */
export const threatLevelSnapshots = pgTable(
  'threat_level_snapshots',
  {
    id: idCol(),
    computedAt: tz('computed_at').notNull().defaultNow(),
    level: smallint('level').notNull(),
    activeZeroDays: integer('active_zero_days').notNull(),
    criticalCves: integer('critical_cves').notNull(),
    unpatchedCritical: integer('unpatched_critical').notNull(),
    weaponizedInWild: integer('weaponized_in_wild').notNull(),
    threatsBlockedYtd: bigint('threats_blocked_ytd', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('threat_level_snapshots_computed_at_idx').on(sql`${table.computedAt} DESC`),
    check('threat_level_snapshots_level_range', sql`${table.level} BETWEEN 1 AND 5`),
  ],
).enableRLS();
