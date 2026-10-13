import type { ContactCategories as ConsentCategories } from '@vunvault/contracts';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';

/**
 * Public intake and the blogger badge (Task 40).
 *
 * Neither table here keeps a raw IP address. `ip_hash` is a SHA-256 of the address
 * and a DAILY salt, which is enough to spot one visitor submitting the form forty
 * times and not enough to reconstruct who they were or to join the row to another
 * day's traffic.
 */

export interface NewContactMessage {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  category: string;
  subject: string;
  message: string;
  ipHash: string | null;
}

export interface NewConsentRecord {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  categories: ConsentCategories;
  policyVersion: string;
  ipHash: string | null;
  userAgent: string | null;
}

export interface BadgeTargetRow {
  id: string;
  email: string;
  fullName: string | null;
  verifiedBloggerAt: string | null;
}

export interface PublicRepo {
  insertContactMessage(input: NewContactMessage): Promise<string>;
  insertConsentRecord(input: NewConsentRecord): Promise<string>;

  findBadgeTarget(userId: string): Promise<BadgeTargetRow | null>;
  grantBadge(userId: string, grantedBy: string, at: Date): Promise<void>;
  revokeBadge(userId: string): Promise<void>;
}

export class SqlPublicRepo implements PublicRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async insertContactMessage(input: NewContactMessage): Promise<string> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into contact_messages
         (id, name, email, organization, category, subject, message, consent, status, ip_hash)
       values ($1::uuid, $2, $3::citext, $4, $5::contact_category, $6, $7, true, 'new', $8)
       returning id::text as id`,
      [
        input.id,
        input.name,
        input.email,
        input.organization,
        input.category,
        input.subject,
        input.message,
        input.ipHash,
      ],
    );
    return rows[0]?.id ?? input.id;
  }

  async insertConsentRecord(input: NewConsentRecord): Promise<string> {
    // Append-only: consent is never updated, a new choice is a new row.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into consent_records
         (id, user_id, anonymous_id, categories, policy_version, ip_hash, user_agent)
       values ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5, $6, $7)
       returning id::text as id`,
      [
        input.id,
        input.userId,
        input.anonymousId,
        JSON.stringify(input.categories),
        input.policyVersion,
        input.ipHash,
        input.userAgent,
      ],
    );
    return rows[0]?.id ?? input.id;
  }

  async findBadgeTarget(userId: string): Promise<BadgeTargetRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        email: string;
        full_name: string | null;
        verified_blogger_at: Date | string | null;
      }>
    >(
      `select id::text as id, email::text as email, full_name, verified_blogger_at
         from profiles
        where id = $1::uuid and deleted_at is null
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      verifiedBloggerAt:
        row.verified_blogger_at === null ? null : new Date(row.verified_blogger_at).toISOString(),
    };
  }

  async grantBadge(userId: string, grantedBy: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update profiles
          set verified_blogger_at = $2, verified_blogger_by = $3::uuid, updated_at = now()
        where id = $1::uuid`,
      [userId, at, grantedBy],
    );
  }

  async revokeBadge(userId: string): Promise<void> {
    await this.executor.unsafe(
      `update profiles
          set verified_blogger_at = null, verified_blogger_by = null, updated_at = now()
        where id = $1::uuid`,
      [userId],
    );
  }
}

/** The cookie that identifies a signed-out visitor for consent purposes. */
export const ANONYMOUS_COOKIE = 'vv_anon';
export const ANONYMOUS_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * A daily salt for the IP hash.
 *
 * Salted per UTC day, so the same visitor hashing to the same value inside one
 * day (which is what abuse detection needs) and to a different value tomorrow
 * (which is what makes the column useless as a long-term identifier).
 */
export function dailySalt(now: Date, pepper: string): string {
  return `${now.toISOString().slice(0, 10)}:${pepper}`;
}
