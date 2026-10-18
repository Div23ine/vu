import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { advisories, advisoryBroadcasts, clientAssets, profiles, type Db } from '@vunvault/db';
import type { ClientAsset } from '@vunvault/lib/advisory-matching';
import type { AdvisoryDeliveryView, BroadcastRow, CounterDelta, OrgContact } from '../ports.js';

/**
 * Postgres adapter for the broadcast worker (Task 89).
 *
 * The worker runs in the trusted OKE zone, so — unlike the scan controller — it
 * holds database credentials. It reads the audience and writes ONLY the
 * delivery counters/status of `advisory_broadcasts` (plus the retraction flip
 * on `advisories`); everything else about a broadcast row is owned by the API.
 *
 * Counter updates are relative (`col = col + n`) and may run concurrently with
 * the Task 94 relay reading the row, so a flush is a single UPDATE and never a
 * read-modify-write.
 */
export class SqlBroadcastRepo {
  constructor(private readonly db: Db) {}

  async getBroadcast(broadcastId: string): Promise<BroadcastRow | null> {
    const rows = await this.db
      .select({
        id: advisoryBroadcasts.id,
        advisoryId: advisoryBroadcasts.advisoryId,
        kind: advisoryBroadcasts.kind,
        status: advisoryBroadcasts.status,
        triggeredBy: advisoryBroadcasts.triggeredBy,
        audienceDashboards: advisoryBroadcasts.audienceDashboards,
        emailContacts: advisoryBroadcasts.emailContacts,
        smsContacts: advisoryBroadcasts.smsContacts,
        sentDashboards: advisoryBroadcasts.sentDashboards,
        sentEmail: advisoryBroadcasts.sentEmail,
        sentSms: advisoryBroadcasts.sentSms,
        failed: advisoryBroadcasts.failed,
        queueJobId: advisoryBroadcasts.queueJobId,
      })
      .from(advisoryBroadcasts)
      .where(eq(advisoryBroadcasts.id, broadcastId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getAdvisory(advisoryId: string): Promise<AdvisoryDeliveryView | null> {
    const rows = await this.db
      .select({
        id: advisories.id,
        cveId: advisories.cveId,
        title: advisories.title,
        summary: advisories.summary,
        remediation: advisories.remediation,
        references: advisories.references,
        severity: advisories.severity,
        cvss: advisories.cvss,
        status: advisories.status,
        scope: advisories.scope,
        disclosureDate: advisories.disclosureDate,
      })
      .from(advisories)
      .where(eq(advisories.id, advisoryId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      cveId: row.cveId,
      // The API enforces a title before publishing; the column is nullable for
      // drafts, so fall back rather than crash a live broadcast.
      title: row.title ?? row.cveId,
      summary: row.summary,
      remediation: row.remediation,
      references: row.references,
      severity: row.severity,
      cvss: row.cvss,
      status: row.status,
      scope: row.scope,
      disclosureDate: row.disclosureDate,
    };
  }

  async listClientAssets(): Promise<ClientAsset[]> {
    const rows = await this.db
      .select({
        orgId: clientAssets.orgId,
        category: clientAssets.category,
        product: clientAssets.product,
        version: clientAssets.version,
        host: clientAssets.host,
      })
      .from(clientAssets);
    return rows;
  }

  async listOrgContacts(orgIds: readonly string[]): Promise<OrgContact[]> {
    if (orgIds.length === 0) return [];
    const rows = await this.db
      .select({
        userId: profiles.id,
        orgId: profiles.orgId,
        email: profiles.email,
        fullName: profiles.fullName,
        phone: profiles.phone,
      })
      .from(profiles)
      .where(
        and(
          inArray(profiles.orgId, [...orgIds]),
          eq(profiles.role, 'client'),
          eq(profiles.accountStatus, 'active'),
          isNull(profiles.deletedAt),
        ),
      );
    return rows.map((row) => ({
      userId: row.userId,
      orgId: row.orgId ?? '',
      email: row.email,
      fullName: row.fullName,
      phone: row.phone,
    }));
  }

  async markSending(broadcastId: string, at: Date): Promise<void> {
    await this.db
      .update(advisoryBroadcasts)
      .set({ status: 'sending', startedAt: at })
      .where(eq(advisoryBroadcasts.id, broadcastId));
  }

  async incrementCounters(broadcastId: string, delta: CounterDelta): Promise<void> {
    const sets: Record<string, unknown> = {};
    if (delta.sentDashboards !== undefined && delta.sentDashboards > 0) {
      sets.sentDashboards = sql`${advisoryBroadcasts.sentDashboards} + ${delta.sentDashboards}`;
    }
    if (delta.sentEmail !== undefined && delta.sentEmail > 0) {
      sets.sentEmail = sql`${advisoryBroadcasts.sentEmail} + ${delta.sentEmail}`;
    }
    if (delta.sentSms !== undefined && delta.sentSms > 0) {
      sets.sentSms = sql`${advisoryBroadcasts.sentSms} + ${delta.sentSms}`;
    }
    if (delta.failed !== undefined && delta.failed > 0) {
      sets.failed = sql`${advisoryBroadcasts.failed} + ${delta.failed}`;
    }
    if (Object.keys(sets).length === 0) return;
    await this.db
      .update(advisoryBroadcasts)
      .set(sets)
      .where(eq(advisoryBroadcasts.id, broadcastId));
  }

  async finish(broadcastId: string, status: 'sent' | 'failed', at: Date): Promise<void> {
    await this.db
      .update(advisoryBroadcasts)
      .set({ status, finishedAt: at })
      .where(eq(advisoryBroadcasts.id, broadcastId));
  }

  async retractAdvisory(advisoryId: string, at: Date): Promise<void> {
    await this.db
      .update(advisories)
      .set({ status: 'retracted', retractedAt: at })
      .where(and(eq(advisories.id, advisoryId), eq(advisories.status, 'published')));
  }
}
