import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid } from './common.js';
import { AuditCategorySchema, AuditSeveritySchema } from './enums.js';
import type { AuditCategory, AuditSeverity } from './enums.js';

/**
 * The audit trail read model.
 *
 * There is intentionally NO create, update or delete schema for an audit entry:
 * the chain is append-only and the database refuses mutation. The only writes are
 * new entries (appended by the API) and verification checkpoints.
 */

/** A SHA-256 digest rendered as 64 lowercase hex characters. */
const Hex64 = z.string().length(64);

export const AuditRangeSchema = z.enum(['1h', '6h', '24h', '7d', '30d']);
export type AuditRange = z.infer<typeof AuditRangeSchema>;

export const AuditEntryView = z.object({
  /** Chain height. */
  seq: z.number().int().positive(),
  id: Uuid,
  category: AuditCategorySchema,
  eventType: z.string(),
  severity: AuditSeveritySchema,
  /** Renders as `SEV-1` … `SEV-3`. */
  sevLevel: z.number().int().min(1).max(3).nullable(),
  actorLabel: z.string(),
  message: z.string(),
  ip: z.string().nullable(),
  subject: z.string().nullable(),
  hash: Hex64,
  prevHash: Hex64,
  createdAt: IsoDateTime,
});
export type AuditEntryView = z.infer<typeof AuditEntryView>;

export const AuditQuery = PageQuery.extend({
  category: AuditCategorySchema.optional(),
  severity: AuditSeveritySchema.optional(),
  actor: z.string().optional(),
  range: AuditRangeSchema.default('24h'),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

export const AuditSummary = z.object({
  events24h: z.number().int().nonnegative(),
  authAttempts: z.number().int().nonnegative(),
  failedAuth: z.number().int().nonnegative(),
  lockedOut: z.number().int().nonnegative(),
  scanCompletions: z.number().int().nonnegative(),
  reportReleases: z.number().int().nonnegative(),
  chainIntegrityPercent: z.number().min(0).max(100),
  hashMismatches: z.number().int().nonnegative(),
  retentionYears: z.number().int().positive(),
});
export type AuditSummary = z.infer<typeof AuditSummary>;

export const ChainStatus = z.object({
  state: z.enum(['intact', 'broken']),
  totalEntries: z.number().int().nonnegative(),
  genesisDate: z.string().date(),
  lastVerifiedAt: IsoDateTime.nullable(),
  hashMismatches: z.number().int().nonnegative(),
  headHash: z.string(),
  /** Verifying node, e.g. `node-nbo-01 · NBO-CORE`. */
  node: z.string(),
  encryption: z.literal('AES-256-GCM'),
});
export type ChainStatus = z.infer<typeof ChainStatus>;

export const VerifyChainResult = z.object({
  checkedFromSeq: z.number().int().positive(),
  checkedToSeq: z.number().int().positive(),
  entries: z.number().int().nonnegative(),
  mismatches: z.number().int().nonnegative(),
  firstMismatchSeq: z.number().int().positive().nullable(),
  verifiedAt: IsoDateTime,
});
export type VerifyChainResult = z.infer<typeof VerifyChainResult>;

/** Server-sent event payload for `GET /api/v1/admin/audit/stream`. */
export const AuditStreamEvent = z.object({
  type: z.enum(['entry', 'heartbeat', 'chain']),
  entry: AuditEntryView.optional(),
  chain: ChainStatus.optional(),
});
export type AuditStreamEvent = z.infer<typeof AuditStreamEvent>;

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  authentication: 'Authentication',
  scan_completion: 'Scan Completion',
  report_release: 'Report Release',
  administrative: 'Administrative',
  security_event: 'Security Event',
  system: 'System',
};

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  ok: 'Success / OK',
  info: 'Informational',
  warning: 'Warning',
  critical: 'Critical',
};

export const AUDIT_RANGE_LABELS: Record<AuditRange, string> = {
  '1h': 'Last hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};
