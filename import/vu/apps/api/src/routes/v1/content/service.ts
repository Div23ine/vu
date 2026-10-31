import type {
  ModerationActionBody,
  ModerationItem,
  ModerationQuery,
  ModerationSummary,
  PublicContentDetail,
  PublicContentItem,
  PublicContentQuery,
  UserRole,
} from '@vunvault/contracts';
import { BLOG_CATEGORY_LABELS } from '@vunvault/contracts';
import type { ContentStatus } from '@vunvault/db/enum-values';
import type { AuditEventType } from '../../../audit/events.js';
import { HttpError } from '../../../lib/http-error.js';
import {
  canTransition,
  DEFAULT_QUEUE_STATUSES,
  nextStatus,
  noteIsLongEnough,
  requiresNote,
  scheduleIsInFuture,
  type ContentAction,
} from './state-machine.js';
import type { ContentItemRow, ContentRepo } from './repo.js';

/**
 * Content moderation.
 *
 * Three rules are worth stating before any code:
 *
 *  - SEPARATION OF DUTIES. Nobody moderates their own submission. A reviewer who
 *    wrote the piece gets `409 own_submission`, not a silent pass.
 *  - LEGAL REVIEW IS A HARD STOP. An item flagged `legal_review_required` cannot
 *    be published by anyone except an administrator. The flag is informational for
 *    `approve` — approving is an editorial judgement, publishing is a legal one.
 *  - HISTORY IS APPEND-ONLY. Every action writes a `content_reviews` row. Nothing
 *    updates or deletes one.
 *
 * Publishing a `threat_advisory` content item does NOT broadcast it: the advisory
 * desk and its emergency broadcast are Task 38's, and conflating the two would
 * let an editor page every client in the country by publishing a blog post.
 */

/** Roles allowed to publish an item carrying the legal-review flag. */
export const LEGAL_OVERRIDE_ROLES: readonly UserRole[] = ['admin', 'super_admin'];

/** The flag that blocks a publish. */
export const LEGAL_FLAG = 'legal_review_required';

/** Email templates rendered by the notify worker. */
export const AUTHOR_TEMPLATE_PREFIX = 'content_';

export interface ModerationActor {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
}

export interface ModerationServiceDeps {
  repo: ContentRepo;
  /** Emails the author; wired to the `notify` queue by the route. */
  notifyAuthor?: (input: {
    to: string;
    template: string;
    vars: Record<string, string>;
  }) => Promise<void>;
  now?: () => Date;
}

export class ModerationService {
  private readonly repo: ContentRepo;
  private readonly notifyAuthor:
    | ((input: { to: string; template: string; vars: Record<string, string> }) => Promise<void>)
    | undefined;
  private readonly now: () => Date;

  constructor(deps: ModerationServiceDeps) {
    this.repo = deps.repo;
    this.notifyAuthor = deps.notifyAuthor;
    this.now = deps.now ?? (() => new Date());
  }

  async list(query: ModerationQuery): Promise<{ data: ModerationItem[]; total: number }> {
    const { rows, total } = await this.repo.listModeration({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
      status: query.status,
      flag: query.flag,
      // No explicit status filter means "the queue": what still needs a decision.
      statuses: query.status === undefined ? DEFAULT_QUEUE_STATUSES : undefined,
    });
    return { data: rows.map(toModerationItem), total };
  }

  async summary(): Promise<ModerationSummary> {
    const now = this.now();
    const counts = await this.repo.summary({
      startOfToday: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
      ),
      weekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      monthAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    });
    return {
      awaitingReview: counts.awaitingReview,
      changesRequested: counts.changesRequested,
      approvedToday: counts.approvedToday,
      rejectedLast7Days: counts.rejectedLast7Days,
      // One decimal place: it is a mean, and a mean of hours is not a precise thing.
      avgReviewHours: Math.round(counts.avgReviewHours * 10) / 10,
      publishedLast30Days: counts.publishedLast30Days,
    };
  }

  /** Apply one moderation action, or refuse it with the reason. */
  async act(
    itemId: string,
    actor: ModerationActor,
    body: ModerationActionBody,
  ): Promise<{ item: ModerationItem; audit: AuditInstruction[] }> {
    const row = await this.repo.getItem(itemId);
    if (row === null) throw HttpError.notFound();

    // Separation of duties.
    if (row.authorId === actor.id) {
      throw new HttpError(
        409,
        'own_submission',
        'You submitted this item, so you cannot moderate it',
      );
    }

    const action = body.action as ContentAction;
    const status = row.status as ContentStatus;

    if (!canTransition(status, action)) {
      throw new HttpError(
        409,
        'invalid_transition',
        `${action} is not available for an item that is ${status}`,
      );
    }
    if (requiresNote(action) && !noteIsLongEnough(body.note)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['note'], message: 'A note of at least 10 characters is required' },
      ]);
    }

    const at = this.now();
    let scheduledFor: Date | undefined;
    if (action === 'schedule') {
      if (!scheduleIsInFuture(body.scheduledFor, at)) {
        throw HttpError.badRequest('validation_failed', [
          { path: ['scheduledFor'], message: 'Choose a publish date and time in the future' },
        ]);
      }
      scheduledFor = new Date(body.scheduledFor as string);
    }

    if (action === 'publish' && isLegallyBlocked(row, actor.role)) {
      throw new HttpError(
        403,
        LEGAL_FLAG,
        'This item needs legal review: only an administrator can publish it',
      );
    }

    const next = nextStatus(status, action);
    await this.repo.applyPatch(itemId, {
      // `remind_author` changes no status.
      ...(next === null ? {} : { status: next }),
      ...(action === 'publish' ? { publishedAt: at } : {}),
      ...(scheduledFor === undefined ? {} : { scheduledFor }),
    });
    // Append-only: one row per action, including the ones that changed nothing.
    await this.repo.insertReview({
      itemId,
      reviewerId: actor.id,
      action,
      note: body.note ?? null,
      at,
    });

    await this.tellTheAuthor(row, action);

    const published = action === 'publish';
    return {
      item: toModerationItem({ ...row, status: next ?? row.status }),
      audit: [
        {
          eventType: published ? 'CONTENT_PUBLISHED' : 'CONTENT_REVIEWED',
          subject: itemId,
          message: published
            ? `${row.title} published to the public feed`
            : `${action} recorded on ${row.title}`,
          details: {
            action,
            contentType: row.type,
            status: next ?? row.status,
            ...(row.cveId === null ? {} : { cveId: row.cveId }),
          },
        },
      ],
    };
  }

  /** Tell the author what happened. A reminder is the only action with no status. */
  // ------------------------------------------------------------ public feed

  /**
   * The public list (Task 40c).
   *
   * Published, and published already: the timestamp is a parameter, so a scheduled
   * post stays invisible until the worker flips it and the same query is
   * reproducible in a test against a fixed clock.
   */
  async publicList(query: PublicContentQuery): Promise<{
    data: PublicContentItem[];
    total: number;
  }> {
    const { rows, total } = await this.repo.listPublished({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
      category: query.category,
      severity: query.severity,
      q: query.q,
      sort: query.sort ?? 'newest',
      now: this.now(),
    });
    return { data: rows.map(toPublicContentItem), total };
  }

  /** The article route. An unpublished or future item is a plain 404. */
  async publicDetail(slug: string): Promise<PublicContentDetail> {
    const row = await this.repo.findPublishedBySlug(slug, this.now());
    if (row === null) throw HttpError.notFound();
    return {
      ...toPublicContentItem(row),
      // Stored sanitised by the Studio (Task 36); the web app renders it with a
      // safe renderer, so nothing here re-parses the Markdown.
      bodyMd: row.bodyMd ?? '',
    };
  }

  private async tellTheAuthor(row: ContentItemRow, action: ContentAction): Promise<void> {
    if (this.notifyAuthor === undefined || row.authorEmail === null) return;
    try {
      await this.notifyAuthor({
        to: row.authorEmail,
        template: `${AUTHOR_TEMPLATE_PREFIX}${action}`,
        vars: {
          title: row.title,
          slugPath: row.slugPath,
          action,
        },
      });
    } catch {
      // A notification that cannot be queued must not roll back a moderation
      // decision: the decision is the record, the email is a courtesy.
    }
  }
}

/** The flag is informational for `approve`; for `publish` it is a hard stop. */
export function isLegallyBlocked(row: ContentItemRow, role: UserRole): boolean {
  return row.riskFlags.includes(LEGAL_FLAG) && !LEGAL_OVERRIDE_ROLES.includes(role);
}

export function toModerationItem(row: ContentItemRow): ModerationItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.excerpt ?? row.summary,
    type: row.type as ModerationItem['type'],
    slugPath: row.slugPath,
    author: {
      id: row.authorId,
      fullName: row.authorName,
      initials: row.authorInitials,
      team: row.authorTeam as ModerationItem['author']['team'],
    },
    // A draft has not been submitted; the queue only shows submitted items, but a
    // `?status=draft` filter must not fail the response schema.
    submittedAt: row.submittedAt ?? row.updatedAt,
    riskFlags: row.riskFlags as ModerationItem['riskFlags'],
    status: row.status as ModerationItem['status'],
    cveId: row.cveId,
  };
}

/** The last segment of a slug path: what `/blog/[slug]` is addressed by. */
export function slugFromPath(slugPath: string): string {
  const parts = slugPath.split('/').filter((part) => part !== '');
  return parts[parts.length - 1] ?? slugPath;
}

/**
 * The public projection.
 *
 * An author's name and nothing else about them: no id, no email, no team. No
 * moderation state, no risk flag and no broadcast internals either — the feed is a
 * projection of what the platform chose to publish, not a view of a row.
 */
export function toPublicContentItem(row: ContentItemRow): PublicContentItem {
  const category = row.category as PublicContentItem['category'];
  return {
    id: row.id,
    type: row.type as PublicContentItem['type'],
    title: row.title,
    // Blog posts carry `excerpt`; the older content types only have `summary`, so
    // the card falls back to its first 240 characters.
    excerpt: row.excerpt ?? truncate(row.summary, 240),
    slug: slugFromPath(row.slugPath),
    slugPath: row.slugPath,
    category,
    categoryLabel: category === null ? null : (BLOG_CATEGORY_LABELS[category] ?? null),
    severity: row.severity as PublicContentItem['severity'],
    tags: row.tags,
    readMinutes: row.readMinutes,
    featuredImageUrl: row.featuredImageUrl,
    imageAlt: row.imageAlt,
    publishedAt: row.publishedAt ?? row.updatedAt,
    author: { fullName: row.authorName },
  };
}

/** Truncate on a word boundary where one is close enough to be worth taking. */
export function truncate(value: string | null, max: number): string | null {
  if (value === null) return null;
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}
