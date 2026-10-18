import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid } from './common.js';
import {
  BlogCategorySchema,
  ContentReviewActionSchema,
  ContentStatusSchema,
  ContentTypeSchema,
  FindingSeveritySchema,
  RiskFlagSchema,
  TeamSchema,
} from './enums.js';
import type {
  BlogCategory,
  ContentStatus,
  ContentType,
  FindingSeverity,
  RiskFlag,
} from './enums.js';

/**
 * Editorial moderation queue and the public content feed.
 *
 * Moderation history is append-only in the database: an action is recorded as a
 * new `content_reviews` row, never as an edit of a previous one.
 */

export const NOTE_REQUIRED_MESSAGE = 'A note of at least 10 characters is required';
export const SCHEDULE_REQUIRED_MESSAGE = 'Choose a publish date and time to schedule';

export const ModerationItem = z.object({
  id: Uuid,
  title: z.string(),
  summary: z.string().nullable(),
  type: ContentTypeSchema,
  slugPath: z.string().min(1),
  author: z.object({
    id: Uuid,
    fullName: z.string(),
    initials: z.string(),
    team: TeamSchema.nullable(),
  }),
  submittedAt: IsoDateTime,
  riskFlags: z.array(RiskFlagSchema),
  status: ContentStatusSchema,
  /** Advisories only, e.g. `CVE-2026-21447`. */
  cveId: z.string().nullable(),
});
export type ModerationItem = z.infer<typeof ModerationItem>;

export const ModerationQuery = PageQuery.extend({
  type: ContentTypeSchema.optional(),
  status: ContentStatusSchema.optional(),
  /** `"none"` filters to items with no risk flags at all. */
  flag: z.union([RiskFlagSchema, z.literal('none')]).optional(),
});
export type ModerationQuery = z.infer<typeof ModerationQuery>;

export const ModerationSummary = z.object({
  awaitingReview: z.number().int().nonnegative(),
  changesRequested: z.number().int().nonnegative(),
  approvedToday: z.number().int().nonnegative(),
  rejectedLast7Days: z.number().int().nonnegative(),
  avgReviewHours: z.number().nonnegative(),
  publishedLast30Days: z.number().int().nonnegative(),
});
export type ModerationSummary = z.infer<typeof ModerationSummary>;

/**
 * A moderation action. `reject` and `request_changes` must carry a substantive
 * note (the author sees it); `schedule` must carry a publish timestamp.
 */
export const ModerationActionBody = z
  .object({
    action: ContentReviewActionSchema,
    note: z.string().max(1000).optional(),
    scheduledFor: IsoDateTime.optional(),
  })
  .superRefine((value, ctx) => {
    const needsNote = value.action === 'reject' || value.action === 'request_changes';
    if (needsNote && (value.note === undefined || value.note.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: NOTE_REQUIRED_MESSAGE,
      });
    }
    if (value.action === 'schedule' && value.scheduledFor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledFor'],
        message: SCHEDULE_REQUIRED_MESSAGE,
      });
    }
  });
export type ModerationActionBody = z.infer<typeof ModerationActionBody>;

/**
 * Published-only projection served to the public site (extended by Task 40b).
 *
 * `summary` became `excerpt`, and the card now carries everything the blog grid
 * renders — category, severity, tags, reading time and the featured image — so the
 * list needs one request instead of one per card. What it still does not carry is
 * an author id, an author email, a moderation state or anything about a broadcast:
 * the public feed is a projection, not a row.
 */
export const PublicContentItem = z.object({
  id: Uuid,
  type: ContentTypeSchema,
  title: z.string(),
  excerpt: z.string().nullable(),
  /** The last segment of `slugPath`: what `/blog/[slug]` is addressed by. */
  slug: z.string().min(1),
  slugPath: z.string().min(1),
  category: BlogCategorySchema.nullable(),
  categoryLabel: z.string().nullable(),
  severity: FindingSeveritySchema.nullable(),
  tags: z.array(z.string()),
  readMinutes: z.number().int().nonnegative().nullable(),
  featuredImageUrl: z.string().nullable(),
  imageAlt: z.string().nullable(),
  publishedAt: IsoDateTime,
  author: z.object({ fullName: z.string() }),
});
export type PublicContentItem = z.infer<typeof PublicContentItem>;

/** `priority` is severity critical→low, then newest: the blog's "Highest Priority". */
export const PUBLIC_CONTENT_SORTS = ['newest', 'priority'] as const;
export type PublicContentSort = (typeof PUBLIC_CONTENT_SORTS)[number];

export const PublicContentQuery = PageQuery.extend({
  type: ContentTypeSchema.optional(),
  category: BlogCategorySchema.optional(),
  severity: FindingSeveritySchema.optional(),
  sort: z.enum(PUBLIC_CONTENT_SORTS).optional(),
});
export type PublicContentQuery = z.infer<typeof PublicContentQuery>;

/** The article route: the card plus the sanitised Markdown body. */
export const PublicContentDetail = PublicContentItem.extend({
  /** Stored sanitised (Task 36); the web app renders it with a safe renderer. */
  bodyMd: z.string(),
});
export type PublicContentDetail = z.infer<typeof PublicContentDetail>;

/** The severity chip on a blog card, verbatim. */
export const SEVERITY_CHIP_LABELS: Record<FindingSeverity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

/** Severity rank for `sort=priority`: lower is more urgent. */
export const SEVERITY_PRIORITY: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type { BlogCategory };

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog Post',
  news_announcement: 'News Announcement',
  threat_advisory: 'Threat Advisory',
  product_listing: 'Product Listing',
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  pending_review: 'Pending Review',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
};

export const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  legal_review_required: 'Legal review required',
  contains_pii: 'Contains PII',
  unverified_claim: 'Unverified claim',
  brand_sensitive: 'Brand-sensitive',
};
