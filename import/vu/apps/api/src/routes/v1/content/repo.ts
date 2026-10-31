import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Content data access: the moderation queue, the Studio and the public feed.
 *
 * `content_reviews` is append-only — an INSERT and nothing else, in this file or
 * anywhere else. A moderation decision is a fact about who did what and when, and
 * correcting one means recording another.
 */

export interface ContentItemRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  bodyMd: string | null;
  slugPath: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorTeam: string | null;
  authorEmail: string | null;
  status: string;
  category: string | null;
  tags: string[];
  featuredImageKey: string | null;
  featuredImageUrl: string | null;
  imageAlt: string | null;
  readMinutes: number | null;
  excerpt: string | null;
  riskFlags: string[];
  cveId: string | null;
  /** Task 40b: the blog's severity chip and its priority sort. */
  severity: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
}

export interface ModerationFilters {
  page: number;
  pageSize: number;
  type?: string;
  status?: string;
  /** A single flag, or `none` for items with no flags at all. */
  flag?: string;
  /** Applied when no explicit `status` filter is given: the default queue. */
  statuses?: readonly string[];
}

export interface SummaryCounts {
  awaitingReview: number;
  changesRequested: number;
  approvedToday: number;
  rejectedLast7Days: number;
  publishedLast30Days: number;
  /** Mean hours from submission to first review action, over the last 30 days. */
  avgReviewHours: number;
}

export interface ItemPatch {
  status?: string;
  title?: string;
  summary?: string | null;
  bodyMd?: string | null;
  slugPath?: string;
  category?: string | null;
  tags?: string[];
  excerpt?: string | null;
  featuredImageKey?: string | null;
  featuredImageUrl?: string | null;
  imageAlt?: string | null;
  readMinutes?: number | null;
  submittedAt?: Date | null;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
}

export interface NewContentItem {
  id: string;
  type: string;
  title: string;
  slugPath: string;
  authorId: string;
  category: string | null;
  excerpt: string | null;
  bodyMd: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  imageAlt: string | null;
  readMinutes: number | null;
  status: string;
}

export interface BadgeRow {
  userId: string;
  displayName: string;
  role: string;
  verifiedBloggerAt: string | null;
}

/** Filters for the public feed (Task 40c). */
export interface PublicContentFilters {
  page: number;
  pageSize: number;
  type?: string;
  category?: string;
  severity?: string;
  /** ILIKE over title, excerpt, tags and an advisory's CVE id. */
  q?: string;
  /** `priority` = severity critical→low, then newest. */
  sort?: 'newest' | 'priority';
  now: Date;
}

export interface ContentRepo {
  listModeration(filters: ModerationFilters): Promise<{ rows: ContentItemRow[]; total: number }>;
  getItem(itemId: string): Promise<ContentItemRow | null>;
  summary(bounds: { startOfToday: Date; weekAgo: Date; monthAgo: Date }): Promise<SummaryCounts>;
  insertReview(input: {
    itemId: string;
    reviewerId: string;
    action: string;
    note: string | null;
    at: Date;
  }): Promise<string>;
  applyPatch(itemId: string, patch: ItemPatch): Promise<void>;

  listAuthorItems(authorId: string): Promise<ContentItemRow[]>;
  latestReviewerNote(itemId: string): Promise<string | null>;
  createItem(input: NewContentItem): Promise<ContentItemRow>;
  slugTaken(slugPath: string): Promise<boolean>;
  deleteDraft(itemId: string): Promise<boolean>;

  badge(userId: string): Promise<BadgeRow | null>;
  /** Active users whose role holds `content:moderate`. */
  moderators(roles: readonly string[]): Promise<Array<{ userId: string; email: string }>>;

  listPublished(filters: PublicContentFilters): Promise<{
    rows: ContentItemRow[];
    total: number;
  }>;
  /** The article route: one published item addressed by the last slug segment. */
  findPublishedBySlug(slug: string, now: Date): Promise<ContentItemRow | null>;
}

const ITEM_COLUMNS = `
  ci.id::text as id,
  ci.type::text as type,
  ci.title,
  ci.summary,
  ci.body_md,
  ci.slug_path,
  ci.author_id::text as author_id,
  coalesce(p.full_name, p.display_name, p.email::text) as author_name,
  p.display_name,
  p.first_name,
  p.last_name,
  ci.author_team::text as author_team,
  p.email::text as author_email,
  ci.status::text as status,
  ci.category::text as category,
  ci.tags,
  ci.featured_image_key,
  ci.featured_image_url,
  ci.image_alt,
  ci.read_minutes,
  ci.excerpt,
  ci.risk_flags::text[] as risk_flags,
  ci.cve_id,
  ci.severity::text as severity,
  ci.submitted_at,
  ci.published_at,
  ci.scheduled_for,
  ci.updated_at`;

const ITEM_FROM = `
  from content_items ci
  join profiles p on p.id = ci.author_id`;

interface SqlItemRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  slug_path: string;
  author_id: string;
  author_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  author_team: string | null;
  author_email: string | null;
  status: string;
  category: string | null;
  tags: string[] | null;
  featured_image_key: string | null;
  featured_image_url: string | null;
  image_alt: string | null;
  read_minutes: number | null;
  excerpt: string | null;
  risk_flags: string[] | null;
  cve_id: string | null;
  severity: string | null;
  submitted_at: Date | string | null;
  published_at: Date | string | null;
  scheduled_for: Date | string | null;
  updated_at: Date | string;
}

/**
 * Bind a `Date` as an ISO-8601 string. postgres-js sends an un-cast Date
 * parameter as text (OID 25) and then tries `Buffer.byteLength(new Date())`,
 * which throws `ERR_INVALID_ARG_TYPE`. Every placeholder that carries a
 * timestamp is cast to `::timestamptz` in the SQL, so a string here parses on
 * the server without issue.
 */
function ts(value: Date): string {
  return value.toISOString();
}

/** Same, but the value may be `null` (an explicit clear of a nullable column). */
function tsOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export class SqlContentRepo implements ContentRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listModeration(
    filters: ModerationFilters,
  ): Promise<{ rows: ContentItemRow[]; total: number }> {
    const { where, values } = this.buildWhere(filters);
    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count ${ITEM_FROM} where ${where}`,
      values,
    );
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `select ${ITEM_COLUMNS} ${ITEM_FROM}
        where ${where}
        order by ci.submitted_at desc nulls last, ci.updated_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    );
    return { rows: rows.map(mapItem), total: Number(totalRows[0]?.count ?? '0') };
  }

  private buildWhere(filters: ModerationFilters): { where: string; values: unknown[] } {
    const values: unknown[] = [];
    const clauses: string[] = [];
    const add = (clause: string, value: unknown, cast?: string): void => {
      values.push(value);
      clauses.push(
        clause.replace('?', `$${values.length}${cast === undefined ? '' : `::${cast}`}`),
      );
    };

    if (filters.type !== undefined) add('ci.type = ?', filters.type, 'content_type');
    if (filters.status !== undefined) {
      add('ci.status = ?', filters.status, 'content_status');
    } else if (filters.statuses !== undefined && filters.statuses.length > 0) {
      add('ci.status::text = any(?)', [...filters.statuses], 'text[]');
    }
    if (filters.flag === 'none') {
      clauses.push('cardinality(ci.risk_flags) = 0');
    } else if (filters.flag !== undefined) {
      add('? = any(ci.risk_flags::text[])', filters.flag);
    }

    return { where: clauses.length === 0 ? 'true' : clauses.join(' and '), values };
  }

  async getItem(itemId: string): Promise<ContentItemRow | null> {
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `select ${ITEM_COLUMNS} ${ITEM_FROM} where ci.id = $1::uuid limit 1`,
      [itemId],
    );
    const row = rows[0];
    return row === undefined ? null : mapItem(row);
  }

  async summary(bounds: {
    startOfToday: Date;
    weekAgo: Date;
    monthAgo: Date;
  }): Promise<SummaryCounts> {
    // Bind the timestamps as ISO strings; the SQL casts them to `::timestamptz`.
    const params = [ts(bounds.startOfToday), ts(bounds.weekAgo), ts(bounds.monthAgo)];
    const counts = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where ci.status in ('pending_review','in_review'))::text as awaiting_review,
         count(*) filter (where ci.status = 'changes_requested')::text as changes_requested,
         count(*) filter (where ci.status = 'published' and ci.published_at >= $3::timestamptz)::text as published_last_30_days
       from content_items ci`,
      params,
    );
    const reviews = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where cr.action = 'approve' and cr.created_at >= $1::timestamptz)::text as approved_today,
         count(*) filter (where cr.action = 'reject' and cr.created_at >= $2::timestamptz)::text as rejected_last_7_days,
         coalesce(avg(
           extract(epoch from (first_action - submitted_at)) / 3600
         ) filter (where submitted_at >= $3::timestamptz), 0)::text as avg_review_hours
       from (
         select cr.action, cr.created_at, ci.submitted_at,
                min(cr.created_at) over (partition by ci.id) as first_action
           from content_reviews cr
           join content_items ci on ci.id = cr.item_id
       ) cr`,
      params,
    );
    const row = counts[0] ?? {};
    const reviewRow = reviews[0] ?? {};
    return {
      awaitingReview: Number(row.awaiting_review ?? 0),
      changesRequested: Number(row.changes_requested ?? 0),
      publishedLast30Days: Number(row.published_last_30_days ?? 0),
      approvedToday: Number(reviewRow.approved_today ?? 0),
      rejectedLast7Days: Number(reviewRow.rejected_last_7_days ?? 0),
      avgReviewHours: Number(reviewRow.avg_review_hours ?? 0),
    };
  }

  async insertReview(input: {
    itemId: string;
    reviewerId: string;
    action: string;
    note: string | null;
    at: Date;
  }): Promise<string> {
    // Append-only. There is no UPDATE and no DELETE for this table anywhere.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into content_reviews (item_id, reviewer_id, action, note, created_at)
       values ($1::uuid, $2::uuid, $3::content_review_action, $4, $5::timestamptz)
       returning id::text as id`,
      [input.itemId, input.reviewerId, input.action, input.note, ts(input.at)],
    );
    return rows[0]?.id ?? '';
  }

  async applyPatch(itemId: string, patch: ItemPatch): Promise<void> {
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [itemId];
    const add = (column: string, value: unknown, cast?: string): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast === undefined ? '' : `::${cast}`}`);
    };

    if (patch.status !== undefined) add('status', patch.status, 'content_status');
    if (patch.title !== undefined) add('title', patch.title);
    if (patch.summary !== undefined) add('summary', patch.summary);
    if (patch.bodyMd !== undefined) add('body_md', patch.bodyMd);
    if (patch.slugPath !== undefined) add('slug_path', patch.slugPath);
    if (patch.category !== undefined) add('category', patch.category, 'blog_category');
    if (patch.tags !== undefined) add('tags', patch.tags, 'text[]');
    if (patch.excerpt !== undefined) add('excerpt', patch.excerpt);
    if (patch.featuredImageKey !== undefined) add('featured_image_key', patch.featuredImageKey);
    if (patch.featuredImageUrl !== undefined) add('featured_image_url', patch.featuredImageUrl);
    if (patch.imageAlt !== undefined) add('image_alt', patch.imageAlt);
    if (patch.readMinutes !== undefined) add('read_minutes', patch.readMinutes);
    // Nullable timestamps: `null` clears the column, a Date binds as an ISO
    // string and is cast to `::timestamptz` server-side.
    if (patch.submittedAt !== undefined) {
      add('submitted_at', tsOrNull(patch.submittedAt), 'timestamptz');
    }
    if (patch.publishedAt !== undefined) {
      add('published_at', tsOrNull(patch.publishedAt), 'timestamptz');
    }
    if (patch.scheduledFor !== undefined) {
      add('scheduled_for', tsOrNull(patch.scheduledFor), 'timestamptz');
    }

    await this.executor.unsafe(
      `update content_items set ${sets.join(', ')} where id = $1::uuid`,
      values,
    );
  }

  async listAuthorItems(authorId: string): Promise<ContentItemRow[]> {
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `select ${ITEM_COLUMNS} ${ITEM_FROM}
        where ci.author_id = $1::uuid and ci.type = 'blog_post'
        order by ci.updated_at desc`,
      [authorId],
    );
    return rows.map(mapItem);
  }

  async latestReviewerNote(itemId: string): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ note: string | null }>>(
      `select note from content_reviews
        where item_id = $1::uuid and action in ('changes_requested','reject','request_changes')
          and note is not null
        order by created_at desc
        limit 1`,
      [itemId],
    );
    return rows[0]?.note ?? null;
  }

  async createItem(input: NewContentItem): Promise<ContentItemRow> {
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `insert into content_items
         (id, type, title, slug_path, author_id, status, category, excerpt, body_md, tags,
          featured_image_url, image_alt, read_minutes)
       values ($1::uuid, $2::content_type, $3, $4, $5::uuid, $6::content_status,
               $7::blog_category, $8, $9, $10::text[], $11, $12, $13)
       returning ${returningColumns()}`,
      [
        input.id,
        input.type,
        input.title,
        input.slugPath,
        input.authorId,
        input.status,
        input.category,
        input.excerpt,
        input.bodyMd,
        input.tags,
        input.featuredImageUrl,
        input.imageAlt,
        input.readMinutes,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('content item was not created');
    return mapItem(row);
  }

  async slugTaken(slugPath: string): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from content_items where slug_path = $1 limit 1`,
      [slugPath],
    );
    return rows.length > 0;
  }

  async deleteDraft(itemId: string): Promise<boolean> {
    // Guarded in SQL as well as in the service: only a draft can be deleted.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `delete from content_items where id = $1::uuid and status = 'draft' returning id::text as id`,
      [itemId],
    );
    return rows.length > 0;
  }

  async badge(userId: string): Promise<BadgeRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        role: string;
        full_name: string | null;
        display_name: string | null;
        email: string;
        verified_blogger_at: Date | string | null;
      }>
    >(
      `select id::text as id, role::text as role, full_name, display_name, email::text as email,
              verified_blogger_at
         from profiles
        where id = $1::uuid
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      userId: row.id,
      displayName: row.display_name ?? row.full_name ?? row.email,
      role: row.role,
      verifiedBloggerAt:
        row.verified_blogger_at === null ? null : new Date(row.verified_blogger_at).toISOString(),
    };
  }

  async moderators(roles: readonly string[]): Promise<Array<{ userId: string; email: string }>> {
    if (roles.length === 0) return [];
    const rows = await this.executor.unsafe<Array<{ id: string; email: string }>>(
      `select p.id::text as id, p.email::text as email
         from profiles p
        where p.role::text = any($1::text[])
          and p.account_status = 'active' and p.deleted_at is null
        order by p.joined_at asc`,
      [[...roles]],
    );
    return rows.map((row) => ({ userId: row.id, email: row.email }));
  }

  async listPublished(
    filters: PublicContentFilters,
  ): Promise<{ rows: ContentItemRow[]; total: number }> {
    const { where, values } = publicWhere(filters);
    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count ${ITEM_FROM} where ${where}`,
      values,
    );
    const offset = (filters.page - 1) * filters.pageSize;
    // `priority` puts a CRITICAL post above a newer MEDIUM one; an item with no
    // severity sorts after every severity the feed can show.
    const order =
      filters.sort === 'priority'
        ? `array_position(array['critical','high','medium','low'], ci.severity::text) nulls last,
           ci.published_at desc`
        : 'ci.published_at desc';
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `select ${ITEM_COLUMNS} ${ITEM_FROM}
        where ${where}
        order by ${order}
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    );
    return { rows: rows.map(mapItem), total: Number(totalRows[0]?.count ?? '0') };
  }

  async findPublishedBySlug(slug: string, now: Date): Promise<ContentItemRow | null> {
    // Matched on the last path segment, so `/blog/x`, `/news/x` and `/advisories/x`
    // are all addressable by the same public slug.
    const rows = await this.executor.unsafe<SqlItemRow[]>(
      `select ${ITEM_COLUMNS} ${ITEM_FROM}
        where ci.status = 'published'
          and ci.published_at is not null
          and ci.published_at <= $2::timestamptz
          and reverse(split_part(reverse(ci.slug_path), '/', 1)) = $1
        limit 1`,
      [slug, ts(now)],
    );
    const row = rows[0];
    return row === undefined ? null : mapItem(row);
  }
}

/**
 * The public feed's WHERE clause: published, and published already.
 *
 * A scheduled post is invisible until the worker flips it, and a draft is invisible
 * forever — both are the same clause, evaluated at read time, which is why the
 * timestamp is a parameter rather than `now()`.
 */
function publicWhere(filters: PublicContentFilters): { where: string; values: unknown[] } {
  // Bound as an ISO string; the SQL casts it to `::timestamptz`.
  const values: unknown[] = [ts(filters.now)];
  const clauses = [
    "ci.status = 'published'",
    'ci.published_at is not null',
    'ci.published_at <= $1::timestamptz',
  ];
  const add = (clause: string, value: unknown, cast?: string): void => {
    values.push(value);
    clauses.push(clause.replace('?', `$${values.length}${cast === undefined ? '' : `::${cast}`}`));
  };

  if (filters.type !== undefined) add('ci.type = ?', filters.type, 'content_type');
  if (filters.category !== undefined) add('ci.category = ?', filters.category, 'blog_category');
  if (filters.severity !== undefined) add('ci.severity = ?', filters.severity, 'finding_severity');
  if (filters.q !== undefined && filters.q !== '') {
    values.push(`%${filters.q}%`);
    const like = `$${values.length}`;
    clauses.push(
      `(ci.title ilike ${like} or coalesce(ci.excerpt, '') ilike ${like}
        or coalesce(ci.summary, '') ilike ${like} or coalesce(ci.cve_id, '') ilike ${like}
        or exists (select 1 from unnest(ci.tags) as tag where tag ilike ${like}))`,
    );
  }
  return { where: clauses.join(' and '), values };
}

/**
 * The insert's RETURNING list, aliased to match every other read. Author details
 * come back empty: the caller re-reads the item, which is what the response is
 * built from anyway.
 */
function returningColumns(): string {
  return `id::text as id, type::text as type, title, summary, body_md, slug_path,
          author_id::text as author_id, '' as author_name, null::text as display_name,
          null::text as first_name, null::text as last_name, author_team::text as author_team,
          null::text as author_email, status::text as status, category::text as category,
          tags, featured_image_key, featured_image_url, image_alt, read_minutes, excerpt,
          risk_flags::text[] as risk_flags, cve_id, submitted_at, published_at, scheduled_for,
          updated_at`;
}

/** `Evelyn Reed` → `ER`; a single name keeps its first two letters. */
export function initialsFor(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const only = parts[0] as string;
    return only.slice(0, 2).toUpperCase();
  }
  const first = (parts[0] as string).charAt(0);
  const last = (parts[parts.length - 1] as string).charAt(0);
  return `${first}${last}`.toUpperCase();
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function mapItem(row: SqlItemRow): ContentItemRow {
  const name = row.author_name ?? row.display_name ?? '';
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    bodyMd: row.body_md,
    slugPath: row.slug_path,
    authorId: row.author_id,
    authorName: name,
    authorInitials: initialsFor(name),
    authorTeam: row.author_team,
    authorEmail: row.author_email,
    status: row.status,
    category: row.category,
    tags: row.tags ?? [],
    featuredImageKey: row.featured_image_key,
    featuredImageUrl: row.featured_image_url,
    imageAlt: row.image_alt,
    readMinutes: row.read_minutes === null ? null : Number(row.read_minutes),
    excerpt: row.excerpt,
    riskFlags: row.risk_flags ?? [],
    cveId: row.cve_id,
    severity: row.severity,
    submittedAt: iso(row.submitted_at),
    publishedAt: iso(row.published_at),
    scheduledFor: iso(row.scheduled_for),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
