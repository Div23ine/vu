import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import {
  advisories,
  advisoryBroadcasts,
  auditCheckpoints,
  auditEntries,
  contentItems,
  endpointStats,
  loginAttempts,
  platformMetricsHourly,
  profiles,
  sensorNodes,
  staffInvitations,
  threatLevelSnapshots,
  type Db,
} from '@vunvault/db';
import type { VerifiableAuditEntry } from '@vunvault/lib/audit-chain';
import type {
  AuditHead,
  CheckpointInput,
  EndpointWindowRow,
  LastCheckpoint,
  MaintenanceRepo,
  PlatformMetricsInput,
  PublishedContentRow,
  StuckBroadcastRow,
  ThreatCounts,
  ThreatSnapshotInput,
} from '../ports';

/**
 * Postgres adapter for the maintenance worker (Task 91; Task 92 extends it).
 *
 * Every sweep is written as a set-based statement — one UPDATE with a
 * condition, one aggregate SELECT — not a read-loop-write. The worker may run
 * with several replicas, and set-based statements are idempotent under
 * concurrency where read-modify-write is not.
 */
export class SqlMaintenanceRepo implements MaintenanceRepo {
  constructor(private readonly db: Db) {}

  // ---- Task 91: metrics rollup ---------------------------------------------

  async listEndpointWindows(from: Date, to: Date): Promise<EndpointWindowRow[]> {
    return this.db
      .select({
        endpoint: endpointStats.endpoint,
        requests: endpointStats.requests,
        avgLatencyMs: endpointStats.avgLatencyMs,
      })
      .from(endpointStats)
      .where(and(gte(endpointStats.windowStart, from), lt(endpointStats.windowStart, to)));
  }

  async upsertPlatformMetrics(input: PlatformMetricsInput): Promise<void> {
    await this.db
      .insert(platformMetricsHourly)
      .values({
        hour: input.hour,
        siteSessions: input.siteSessions,
        apiRequests: input.apiRequests,
        avgResponseMs: input.avgResponseMs,
        p95ResponseMs: input.p95ResponseMs,
        threatsBlocked: input.threatsBlocked,
      })
      .onConflictDoUpdate({
        target: platformMetricsHourly.hour,
        set: {
          siteSessions: input.siteSessions,
          apiRequests: input.apiRequests,
          avgResponseMs: input.avgResponseMs,
          p95ResponseMs: input.p95ResponseMs,
          threatsBlocked: input.threatsBlocked,
        },
      });
  }

  // ---- Task 91: node health --------------------------------------------------

  async sweepStaleNodes(
    cutoff: Date,
    missLimit: number,
  ): Promise<{ degraded: number; offline: number }> {
    const rows = await this.db
      .update(sensorNodes)
      .set({
        missedHeartbeats: sql`${sensorNodes.missedHeartbeats} + 1`,
        status: sql`CASE WHEN ${sensorNodes.missedHeartbeats} + 1 >= ${missLimit}
                         THEN 'offline'::node_status
                         ELSE ${sensorNodes.status} END`,
      })
      .where(
        and(
          or(
            lt(sensorNodes.lastHeartbeatAt, cutoff),
            and(isNull(sensorNodes.lastHeartbeatAt), lt(sensorNodes.createdAt, cutoff)),
          ),
          sql`${sensorNodes.status} <> 'offline'`,
        ),
      )
      .returning({ id: sensorNodes.id, status: sensorNodes.status });

    const offline = rows.filter((row) => row.status === 'offline').length;
    return { degraded: rows.length - offline, offline };
  }

  async recoverNodes(cutoff: Date): Promise<number> {
    const rows = await this.db
      .update(sensorNodes)
      .set({ status: 'operational', missedHeartbeats: 0 })
      .where(
        and(
          eq(sensorNodes.status, 'offline'),
          isNotNull(sensorNodes.lastHeartbeatAt),
          sql`${sensorNodes.lastHeartbeatAt} >= ${cutoff}`,
        ),
      )
      .returning({ id: sensorNodes.id });
    return rows.length;
  }

  // ---- Task 91: threat level -------------------------------------------------

  async countAdvisoryThreats(): Promise<ThreatCounts> {
    const rows = await this.db
      .select({
        criticalCves:
          sql<number>`count(*) FILTER (WHERE ${advisories.severity} = 'critical')`.mapWith(Number),
        unpatchedCritical:
          sql<number>`count(*) FILTER (WHERE ${advisories.severity} = 'critical' AND ${advisories.patchStatus} = 'unpatched')`.mapWith(
            Number,
          ),
        weaponizedInWild: sql<number>`count(*) FILTER (WHERE ${advisories.weaponized})`.mapWith(
          Number,
        ),
        activeZeroDays:
          sql<number>`count(*) FILTER (WHERE ${advisories.patchStatus} = 'unpatched' AND (${advisories.weaponized} OR ${advisories.publicPoc}))`.mapWith(
            Number,
          ),
      })
      .from(advisories)
      .where(eq(advisories.status, 'published'));
    const row = rows[0];
    return {
      criticalCves: row?.criticalCves ?? 0,
      unpatchedCritical: row?.unpatchedCritical ?? 0,
      weaponizedInWild: row?.weaponizedInWild ?? 0,
      activeZeroDays: row?.activeZeroDays ?? 0,
    };
  }

  async insertThreatSnapshot(input: ThreatSnapshotInput): Promise<void> {
    await this.db.insert(threatLevelSnapshots).values({
      level: input.level,
      activeZeroDays: input.activeZeroDays,
      criticalCves: input.criticalCves,
      unpatchedCritical: input.unpatchedCritical,
      weaponizedInWild: input.weaponizedInWild,
      threatsBlockedYtd: input.threatsBlockedYtd,
      computedAt: input.computedAt,
    });
  }

  // ---- Task 91: scheduled publish --------------------------------------------

  async publishScheduledContent(now: Date): Promise<PublishedContentRow[]> {
    const flipped = await this.db
      .update(contentItems)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(
        and(
          eq(contentItems.status, 'scheduled'),
          isNotNull(contentItems.scheduledFor),
          sql`${contentItems.scheduledFor} <= ${now}`,
        ),
      )
      .returning({
        id: contentItems.id,
        title: contentItems.title,
        slugPath: contentItems.slugPath,
        authorId: contentItems.authorId,
      });

    if (flipped.length === 0) return [];

    const authorIds = [
      ...new Set(flipped.map((row) => row.authorId).filter((id): id is string => id !== null)),
    ];
    const authors =
      authorIds.length === 0
        ? []
        : await this.db
            .select({ id: profiles.id, email: profiles.email })
            .from(profiles)
            .where(inArray(profiles.id, authorIds));
    const emailById = new Map(authors.map((author) => [author.id, author.email]));

    return flipped.map((row) => ({
      id: row.id,
      title: row.title,
      slugPath: row.slugPath,
      authorEmail: row.authorId === null ? null : (emailById.get(row.authorId) ?? null),
    }));
  }
  // ---- Task 92: purges, expiries and decay -----------------------------------

  async purgeLoginAttempts(cutoff: Date): Promise<number> {
    const rows = await this.db
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, cutoff))
      .returning({ id: loginAttempts.id });
    return rows.length;
  }

  async expireInvitations(cutoff: Date): Promise<number> {
    const rows = await this.db
      .update(staffInvitations)
      .set({ status: 'expired' })
      .where(and(eq(staffInvitations.status, 'pending'), lt(staffInvitations.expiresAt, cutoff)))
      .returning({ id: staffInvitations.id });
    return rows.length;
  }

  async flagDormantClients(cutoff: Date): Promise<number> {
    // Staff are never auto-flagged: their access reviews are a human process.
    const rows = await this.db
      .update(profiles)
      .set({ accountStatus: 'dormant' })
      .where(
        and(
          eq(profiles.accountStatus, 'active'),
          eq(profiles.role, 'client'),
          isNotNull(profiles.lastActiveAt),
          lt(profiles.lastActiveAt, cutoff),
          isNull(profiles.deletedAt),
        ),
      )
      .returning({ id: profiles.id });
    return rows.length;
  }

  async flagStaleSignups(cutoff: Date): Promise<number> {
    const rows = await this.db
      .update(profiles)
      .set({ accountStatus: 'dormant' })
      .where(
        and(
          eq(profiles.accountStatus, 'pending_verification'),
          lt(profiles.joinedAt, cutoff),
          isNull(profiles.deletedAt),
        ),
      )
      .returning({ id: profiles.id });
    return rows.length;
  }

  // ---- Task 92: chain verification and the audit snapshot ---------------------

  async lastCheckpoint(): Promise<LastCheckpoint | null> {
    const rows = await this.db
      .select({
        toSeq: auditCheckpoints.toSeq,
        headHash: auditCheckpoints.headHash,
        mismatches: auditCheckpoints.mismatches,
        verifiedAt: auditCheckpoints.verifiedAt,
      })
      .from(auditCheckpoints)
      .orderBy(desc(auditCheckpoints.toSeq))
      .limit(1);
    return rows[0] ?? null;
  }

  async listAuditEntriesAfter(afterSeq: number, limit: number): Promise<VerifiableAuditEntry[]> {
    const rows = await this.db
      .select({
        seq: auditEntries.seq,
        category: auditEntries.category,
        eventType: auditEntries.eventType,
        severity: auditEntries.severity,
        actorLabel: auditEntries.actorLabel,
        subject: auditEntries.subject,
        message: auditEntries.message,
        details: auditEntries.details,
        createdAt: auditEntries.createdAt,
        prevHash: auditEntries.prevHash,
        hash: auditEntries.hash,
        signature: auditEntries.signature,
        keyId: auditEntries.keyId,
      })
      .from(auditEntries)
      .where(gt(auditEntries.seq, afterSeq))
      .orderBy(auditEntries.seq)
      .limit(limit);
    return rows;
  }

  async insertCheckpoint(input: CheckpointInput): Promise<void> {
    await this.db.insert(auditCheckpoints).values({
      fromSeq: input.fromSeq,
      toSeq: input.toSeq,
      entries: input.entries,
      mismatches: input.mismatches,
      headHash: input.headHash,
      verifiedBy: input.verifiedBy,
    });
  }

  async auditHead(): Promise<AuditHead | null> {
    const rows = await this.db
      .select({ seq: auditEntries.seq, hash: auditEntries.hash })
      .from(auditEntries)
      .orderBy(desc(auditEntries.seq))
      .limit(1);
    const head = rows[0];
    return head === undefined ? null : { seq: head.seq, hash: head.hash };
  }

  // ---- Task 92: broadcast outbox ----------------------------------------------

  async listStuckBroadcasts(cutoff: Date): Promise<StuckBroadcastRow[]> {
    const rows = await this.db
      .select({
        broadcastId: advisoryBroadcasts.id,
        advisoryId: advisoryBroadcasts.advisoryId,
        kind: advisoryBroadcasts.kind,
      })
      .from(advisoryBroadcasts)
      .where(
        and(eq(advisoryBroadcasts.status, 'queued'), lt(advisoryBroadcasts.createdAt, cutoff)),
      );
    return rows;
  }

  // ---- Task 92: media validation sweep -------------------------------------------

  async listAvatarKeys(): Promise<Array<{ id: string; avatarKey: string }>> {
    return this.db
      .select({ id: profiles.id, avatarKey: profiles.avatarKey })
      .from(profiles)
      .where(isNotNull(profiles.avatarKey))
      .then((rows) => rows.map((row) => ({ id: row.id, avatarKey: row.avatarKey as string })));
  }

  async listFeaturedImageUrls(): Promise<Array<{ id: string; featuredImageUrl: string }>> {
    return this.db
      .select({ id: contentItems.id, featuredImageUrl: contentItems.featuredImageUrl })
      .from(contentItems)
      .where(isNotNull(contentItems.featuredImageUrl))
      .then((rows) =>
        rows.map((row) => ({ id: row.id, featuredImageUrl: row.featuredImageUrl as string })),
      );
  }
}
