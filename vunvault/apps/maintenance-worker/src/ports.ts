/**
 * Ports (Tasks 91–92) — the seams the maintenance worker depends on.
 *
 * Every handler is a pure-ish function over these interfaces, so the whole
 * maintenance catalogue is testable with fakes: no live Postgres, Redis or R2
 * in unit tests. `Summary` is the single shape every handler returns; the
 * consumer logs it at `info`, which makes one grep line per run the operator's
 * audit trail of the sweep itself.
 */

import type { VerifiableAuditEntry } from '@vunvault/lib/audit-chain';
import type { ObjectWriter } from '@vunvault/lib/storage';

export type { ObjectWriter, VerifiableAuditEntry };

export interface Summary {
  task: string;
  /** Rows the handler changed (or checked, for read-only sweeps — each says which). */
  affected: number;
  detail?: Record<string, number | string>;
}

/** One `endpoint_stats` window row, as the rollup sees it. */
export interface EndpointWindowRow {
  endpoint: string;
  requests: number;
  avgLatencyMs: number;
}

export interface PlatformMetricsInput {
  hour: Date;
  siteSessions: number;
  apiRequests: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  threatsBlocked: number;
}

export interface ThreatCounts {
  criticalCves: number;
  unpatchedCritical: number;
  weaponizedInWild: number;
  activeZeroDays: number;
}

export interface ThreatSnapshotInput extends ThreatCounts {
  level: number;
  threatsBlockedYtd: number;
  computedAt: Date;
}

export interface PublishedContentRow {
  id: string;
  title: string;
  slugPath: string;
  authorEmail: string | null;
}

/** What the audit snapshot needs: the current chain head and entry count. */
export interface AuditHead {
  seq: number;
  hash: string;
}

/** The latest verification checkpoint the sweep resumes from. */
export interface LastCheckpoint {
  toSeq: number;
  headHash: string;
  mismatches: number;
  verifiedAt: Date;
}

export interface CheckpointInput {
  fromSeq: number;
  toSeq: number;
  entries: number;
  mismatches: number;
  headHash: string;
  verifiedBy: string;
}

/** A stuck broadcast row the outbox sweep re-enqueues. */
export interface StuckBroadcastRow {
  broadcastId: string;
  advisoryId: string;
  kind: 'initial' | 'rebroadcast' | 'retraction';
}

export interface MaintenanceRepo {
  // ---- Task 91 -------------------------------------------------------------
  listEndpointWindows(from: Date, to: Date): Promise<EndpointWindowRow[]>;
  upsertPlatformMetrics(input: PlatformMetricsInput): Promise<void>;
  /** Stale, not-yet-offline nodes: +1 missed heartbeat, offline at the limit. */
  sweepStaleNodes(cutoff: Date, missLimit: number): Promise<{ degraded: number; offline: number }>;
  /** Offline nodes that beat again: back to operational, counter reset. */
  recoverNodes(cutoff: Date): Promise<number>;
  countAdvisoryThreats(): Promise<ThreatCounts>;
  insertThreatSnapshot(input: ThreatSnapshotInput): Promise<void>;
  /** `scheduled` items whose time has come → `published`; returns what flipped. */
  publishScheduledContent(now: Date): Promise<PublishedContentRow[]>;

  // ---- Task 92 -------------------------------------------------------------
  /** DELETE login_attempts older than the cutoff; returns rows deleted. */
  purgeLoginAttempts(cutoff: Date): Promise<number>;
  /** pending → expired past `expires_at` (+ grace); returns rows updated. */
  expireInvitations(cutoff: Date): Promise<number>;
  /** active clients unseen since the cutoff → dormant; staff are never touched. */
  flagDormantClients(cutoff: Date): Promise<number>;
  /** pending_verification signups older than the cutoff → dormant. */
  flagStaleSignups(cutoff: Date): Promise<number>;
  lastCheckpoint(): Promise<LastCheckpoint | null>;
  /** Ordered entries with `seq > afterSeq`, at most `limit`. */
  listAuditEntriesAfter(afterSeq: number, limit: number): Promise<VerifiableAuditEntry[]>;
  insertCheckpoint(input: CheckpointInput): Promise<void>;
  auditHead(): Promise<AuditHead | null>;
  /** `advisory_broadcasts` stuck in `queued` since before the cutoff. */
  listStuckBroadcasts(cutoff: Date): Promise<StuckBroadcastRow[]>;
  listAvatarKeys(): Promise<Array<{ id: string; avatarKey: string }>>;
  listFeaturedImageUrls(): Promise<Array<{ id: string; featuredImageUrl: string }>>;
}

/** Re-enqueue a stuck broadcast onto the `broadcast` queue (Task 89 consumes). */
export interface BroadcastProducer {
  requeue(job: StuckBroadcastRow): Promise<void>;
}

/** E-mail enqueue onto the `notify` queue (consumed by Task 90's worker). */
export interface NotifyEnqueuer {
  enqueueEmail(
    payload: { to: string; template: string; vars: Record<string, string> },
    jobId: string,
  ): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}
