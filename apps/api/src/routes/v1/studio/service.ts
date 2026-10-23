import type {
  StudioDraftBody,
  StudioImageUploadRequest,
  StudioItem,
  StudioStatus,
  StudioSubmitReadiness,
} from '@vunvault/contracts';
import {
  countWords,
  isReadyToSubmit,
  readMinutes,
  ROLE_PERMISSIONS,
  STUDIO_LIMITS,
} from '@vunvault/contracts';
import type { ContentStatus } from '@vunvault/db/enum-values';
import type { AuditEventType } from '../../../audit/events';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import { canTransition, isEditable } from '../content/state-machine';
import type { ContentItemRow, ContentRepo } from '../content/repo';
import { normaliseTags, sanitiseMarkdown } from './markdown';
import {
  blogSlugPath,
  draftSlugSeed,
  isExplicitSlug,
  nextSlugCandidate,
  SLUG_MAX_ATTEMPTS,
  slugify,
} from './slug';

/**
 * The Content Studio: self-service authoring for verified journalists and
 * bloggers, and for staff who hold `content:author`.
 *
 * Access is a server-side badge (`profiles.verified_blogger_at`), granted by an
 * administrator. Nothing here reads browser storage, and nothing here trusts a
 * claim from the client about who the author is: the author is always
 * `request.user.id`.
 *
 * A draft is the author's, and only while it is a draft. Once it is submitted the
 * author cannot edit it into a different article behind a moderator's back — the
 * item comes back to `changes_requested` first, which is an audited decision.
 */

/** Object-storage prefix for Studio images. */
export const STUDIO_IMAGE_PREFIX = 'studio/';
export const STUDIO_IMAGE_MAX_BYTES = STUDIO_LIMITS.imageMaxBytes;
/** How long an image upload URL stays valid. */
export const STUDIO_UPLOAD_SECONDS = 300;

const IMAGE_EXTENSIONS: Record<StudioImageUploadRequest['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** A draft save is audited at most this often per item, so typing is not noise. */
export const DRAFT_AUDIT_INTERVAL_MS = 60_000;

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
}

export interface StudioServiceDeps {
  repo: ContentRepo;
  storage?: ObjectStorage;
  /** `app.notify.dispatch`, for telling moderators a submission arrived. */
  notify?: (input: { userId: string; title: string; body: string }) => Promise<void>;
  now?: () => Date;
  randomUuid?: () => string;
  /**
   * Shared across requests by the route plugin: the throttle on
   * `CONTENT_DRAFT_SAVED` has to outlive one request, and a service is built per
   * transaction.
   */
  draftAuditLog?: Map<string, number>;
}

export class StudioService {
  private readonly repo: ContentRepo;
  private readonly storage: ObjectStorage | undefined;
  private readonly notify:
    ((input: { userId: string; title: string; body: string }) => Promise<void>) | undefined;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;
  /** Last audited draft save per item, so a save storm writes one entry a minute. */
  private readonly lastDraftAudit: Map<string, number>;

  constructor(deps: StudioServiceDeps) {
    this.repo = deps.repo;
    this.storage = deps.storage;
    this.notify = deps.notify;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
    this.lastDraftAudit = deps.draftAuditLog ?? new Map<string, number>();
  }

  /** Any authenticated user may ask; the answer is what the UI branches on. */
  async status(userId: string): Promise<StudioStatus> {
    const badge = await this.repo.badge(userId);
    if (badge === null) throw HttpError.unauthorized();
    return {
      verified: isVerifiedBlogger(badge.verifiedBloggerAt, badge.role),
      verifiedAt: badge.verifiedBloggerAt,
      displayName: badge.displayName,
    };
  }

  /**
   * The badge gate. A verified blogger OR a role that holds `content:author`;
   * everyone else gets `403 badge_required` and the UI shows the badge screen.
   */
  async requireBlogger(userId: string, role: string): Promise<void> {
    const badge = await this.repo.badge(userId);
    if (badge !== null && isVerifiedBlogger(badge.verifiedBloggerAt, badge.role)) return;
    if (roleHoldsContentAuthor(role)) return;
    throw new HttpError(403, 'badge_required', 'Verified Journalist / Blogger badge required');
  }

  async submissions(userId: string): Promise<{ data: StudioItem[]; total: number }> {
    const rows = await this.repo.listAuthorItems(userId);
    const data: StudioItem[] = [];
    for (const row of rows) {
      data.push(await this.toStudioItem(row));
    }
    return { data, total: data.length };
  }

  async createDraft(userId: string, body: StudioDraftBody): Promise<StudioItem> {
    const id = this.randomUuid();
    const title = body.title?.trim() ?? '';
    const slug = await this.allocateSlug(body.slug, title, id);
    const bodyMd = body.bodyMd === undefined ? null : sanitiseMarkdown(body.bodyMd);

    const created = await this.repo.createItem({
      id,
      type: 'blog_post',
      // `title` is NOT NULL in the schema; an untitled draft stores an empty
      // string, and readiness is what stops it being submitted.
      title,
      slugPath: slug,
      authorId: userId,
      category: body.category ?? null,
      excerpt: body.excerpt ?? null,
      bodyMd,
      tags: normaliseTags(body.tags, STUDIO_LIMITS.tags),
      featuredImageUrl: body.featuredImageUrl ?? null,
      imageAlt: body.imageAlt ?? null,
      readMinutes: bodyMd === null ? null : readMinutes(bodyMd),
      status: 'draft',
    });

    const row = (await this.repo.getItem(id)) ?? created;
    return this.toStudioItem(row);
  }

  async updateDraft(
    userId: string,
    itemId: string,
    body: StudioDraftBody,
  ): Promise<{ item: StudioItem; audit: AuditInstruction[] }> {
    const row = await this.ownEditableItem(userId, itemId);

    const patch: Parameters<ContentRepo['applyPatch']>[1] = {};
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.category !== undefined) patch.category = body.category;
    if (body.excerpt !== undefined) patch.excerpt = body.excerpt;
    if (body.imageAlt !== undefined) patch.imageAlt = body.imageAlt;
    if (body.featuredImageUrl !== undefined) patch.featuredImageUrl = body.featuredImageUrl;
    if (body.tags.length > 0) patch.tags = normaliseTags(body.tags, STUDIO_LIMITS.tags);
    if (body.bodyMd !== undefined) {
      patch.bodyMd = sanitiseMarkdown(body.bodyMd);
      patch.readMinutes = readMinutes(patch.bodyMd);
    }
    // An explicit slug, or a new title on an item that has no words in its slug
    // yet, re-derives the path. A published path is never rewritten.
    if (body.slug !== undefined || (body.title !== undefined && row.title === '')) {
      patch.slugPath = await this.allocateSlug(
        body.slug,
        body.title ?? row.title,
        itemId,
        row.slugPath,
      );
    }

    await this.repo.applyPatch(itemId, patch);
    const updated = (await this.repo.getItem(itemId)) ?? ({ ...row, ...patch } as ContentItemRow);

    return {
      item: await this.toStudioItem(updated),
      audit: this.throttledDraftAudit(itemId, updated.title),
    };
  }

  /** At most one `CONTENT_DRAFT_SAVED` entry per item per minute. */
  private throttledDraftAudit(itemId: string, title: string): AuditInstruction[] {
    const at = this.now().getTime();
    const previous = this.lastDraftAudit.get(itemId);
    if (previous !== undefined && at - previous < DRAFT_AUDIT_INTERVAL_MS) return [];
    this.lastDraftAudit.set(itemId, at);
    return [
      {
        eventType: 'CONTENT_DRAFT_SAVED',
        subject: itemId,
        message: `Draft saved${title === '' ? '' : `: ${title}`}`,
        details: { itemId },
      },
    ];
  }

  async submit(
    userId: string,
    itemId: string,
  ): Promise<{ item: StudioItem; audit: AuditInstruction[] }> {
    const row = await this.ownEditableItem(userId, itemId);
    if (!canTransition(row.status as ContentStatus, 'submit')) {
      throw new HttpError(409, 'invalid_transition', `A ${row.status} item cannot be submitted`);
    }

    const readiness = readinessFor(row);
    if (!isReadyToSubmit(readiness)) {
      // The envelope's `details` is an array, so the readiness object is its only
      // member: the UI reads the same six booleans it renders as a checklist.
      throw new HttpError(422, 'not_ready', 'Finish the required fields before submitting', [
        readiness,
      ]);
    }

    const at = this.now();
    await this.repo.applyPatch(itemId, { status: 'pending_review', submittedAt: at });
    await this.tellModerators(row);

    const updated = (await this.repo.getItem(itemId)) ?? row;
    return {
      item: await this.toStudioItem({ ...updated, status: 'pending_review' }),
      audit: [
        {
          eventType: 'CONTENT_SUBMITTED',
          subject: itemId,
          message: `${row.title} submitted for moderation`,
          details: { itemType: row.type, wordCount: countWords(row.bodyMd ?? '') },
        },
      ],
    };
  }

  async deleteDraft(userId: string, itemId: string): Promise<void> {
    const row = await this.repo.getItem(itemId);
    if (row === null || row.authorId !== userId) throw HttpError.notFound();
    if (row.status !== 'draft') {
      throw new HttpError(409, 'not_editable', 'Only a draft can be deleted');
    }
    const deleted = await this.repo.deleteDraft(itemId);
    if (!deleted) throw new HttpError(409, 'not_editable', 'Only a draft can be deleted');
  }

  async imageUploadUrl(
    userId: string,
    body: StudioImageUploadRequest,
  ): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string; expiresAt: string }> {
    if (this.storage === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Object storage is not configured');
    }
    if (body.sizeBytes > STUDIO_IMAGE_MAX_BYTES) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['sizeBytes'], message: 'Images are five megabytes at most' },
      ]);
    }
    const extension = IMAGE_EXTENSIONS[body.contentType];
    const objectKey = `${STUDIO_IMAGE_PREFIX}${userId}/${this.randomUuid()}.${extension}`;
    const { url } = await this.storage.presignPut({
      key: objectKey,
      contentType: body.contentType,
      maxBytes: STUDIO_IMAGE_MAX_BYTES,
      expiresSec: STUDIO_UPLOAD_SECONDS,
    });
    return {
      uploadUrl: url,
      objectKey,
      publicUrl: this.storage.publicUrl(objectKey),
      expiresAt: new Date(this.now().getTime() + STUDIO_UPLOAD_SECONDS * 1000).toISOString(),
    };
  }

  // ------------------------------------------------------------------ helpers

  /** The caller's own item, and only while it is still editable. */
  private async ownEditableItem(userId: string, itemId: string): Promise<ContentItemRow> {
    const row = await this.repo.getItem(itemId);
    // Somebody else's draft does not exist as far as this author is concerned.
    if (row === null || row.authorId !== userId) throw HttpError.notFound();
    if (!isEditable(row.status as ContentStatus)) {
      throw new HttpError(
        409,
        'not_editable',
        `A ${row.status} item cannot be edited. Ask a moderator to request changes.`,
      );
    }
    return row;
  }

  /** First free `/blog/<slug>`, suffixing `-2`, `-3`, … on a collision. */
  private async allocateSlug(
    explicit: string | undefined,
    title: string,
    itemId: string,
    currentPath?: string,
  ): Promise<string> {
    const base =
      explicit !== undefined && isExplicitSlug(explicit)
        ? explicit
        : slugify(title) === ''
          ? draftSlugSeed(itemId)
          : slugify(title);

    for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt += 1) {
      const candidate = blogSlugPath(nextSlugCandidate(base, attempt));
      if (candidate === currentPath) return candidate;
      if (!(await this.repo.slugTaken(candidate))) return candidate;
    }
    throw new HttpError(409, 'slug_unavailable', 'Could not allocate a unique URL for this post');
  }

  private async tellModerators(row: ContentItemRow): Promise<void> {
    if (this.notify === undefined) return;
    const moderators = await this.repo.moderators(rolesWithContentModerate());
    for (const moderator of moderators) {
      await this.notify({
        userId: moderator.userId,
        title: 'A post is waiting for moderation',
        body: `${row.title === '' ? 'An untitled draft' : row.title} was submitted for review.`,
      }).catch(() => undefined);
    }
  }

  private async toStudioItem(row: ContentItemRow): Promise<StudioItem> {
    const reviewerNote =
      row.status === 'changes_requested' || row.status === 'rejected'
        ? await this.repo.latestReviewerNote(row.id)
        : null;
    return {
      id: row.id,
      title: row.title === '' ? null : row.title,
      slugPath: row.slugPath,
      category: row.category as StudioItem['category'],
      excerpt: row.excerpt,
      bodyMd: row.bodyMd,
      tags: row.tags,
      featuredImageUrl: row.featuredImageUrl,
      imageAlt: row.imageAlt,
      status: row.status as StudioItem['status'],
      readiness: readinessFor(row),
      readMinutes: row.readMinutes,
      updatedAt: row.updatedAt,
      reviewerNote,
    };
  }
}

/** The badge OR the staff permission; either one opens the Studio. */
export function isVerifiedBlogger(verifiedBloggerAt: string | null, role: string): boolean {
  return verifiedBloggerAt !== null || roleHoldsContentAuthor(role);
}

export function roleHoldsContentAuthor(role: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return permissions !== undefined && permissions.includes('content:author');
}

/** Roles whose members moderate content: they are who a submission is sent to. */
export function rolesWithContentModerate(): string[] {
  return (Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>).filter((role) =>
    ROLE_PERMISSIONS[role].includes('content:moderate'),
  );
}

/** The six-item checklist the Studio renders, computed from the row. */
export function readinessFor(row: {
  title: string;
  category: string | null;
  bodyMd: string | null;
  excerpt: string | null;
  featuredImageUrl: string | null;
  tags: string[];
}): StudioSubmitReadiness {
  return {
    title: row.title.trim() !== '',
    category: row.category !== null,
    bodyWords: countWords(row.bodyMd ?? '') >= STUDIO_LIMITS.minWords,
    excerpt: (row.excerpt ?? '').trim() !== '',
    featuredImage: row.featuredImageUrl !== null,
    tags: row.tags.length >= 2,
  };
}
