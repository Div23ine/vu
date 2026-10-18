import { z } from 'zod';
import { IsoDateTime, Uuid } from './common.js';
import { BlogCategorySchema, ContentStatusSchema } from './enums.js';
import type { BlogCategory } from './enums.js';

/**
 * Content Studio — the self-service authoring surface for verified journalists /
 * bloggers and for staff holding `content:author`.
 *
 * Access is a server-side badge (`profiles.verified_blogger_at`, granted by an
 * administrator after a Contact-page verification request). Nothing here is gated
 * by browser storage.
 */

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  news: 'News',
  threat_intel: 'Threat Intel',
  blog: 'Blog',
  industry_updates: 'Industry Updates',
  tutorials: 'Tutorials',
};

export const STUDIO_TAG_SUGGESTIONS = [
  '#security',
  '#threatintel',
  '#fintech',
  '#africa',
  '#compliance',
  '#research',
] as const;

export const STUDIO_LIMITS = {
  title: 120,
  excerpt: 240,
  tags: 8,
  minWords: 150,
  imageMaxBytes: 5_242_880,
} as const;

/** Reading speed used by `readMinutes`. */
export const STUDIO_WORDS_PER_MINUTE = 200;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A tag is stored lower-cased without the leading `#`; the `#` is optional input. */
export const TAG_PATTERN = /^#?[a-z0-9-]{2,30}$/;

/**
 * Word count for a Markdown body: fenced and inline code, images and table
 * separator rows are dropped, link labels are kept, and block/inline markers are
 * treated as whitespace. A heuristic, but a stable one — the same text always
 * yields the same count, so the "Body ≥ 150 words" gate cannot be gamed.
 */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|[-\s|:]+\|\s*$/gm, ' ')
    .replace(/[#>*~|]/g, ' ');
  return text.split(/\s+/).filter((token) => token.length > 0).length;
}

/** Reading time in minutes at 200 wpm, never below one minute. */
export function readMinutes(markdown: string, wordsPerMinute = STUDIO_WORDS_PER_MINUTE): number {
  const minutes = countWords(markdown) / wordsPerMinute;
  return Math.max(1, Math.round(minutes));
}

export const StudioDraftBody = z.object({
  title: z.string().max(STUDIO_LIMITS.title).optional(),
  slug: z
    .string()
    .regex(SLUG_PATTERN, 'Lowercase letters, numbers and single hyphens only')
    .optional(),
  category: BlogCategorySchema.optional(),
  excerpt: z.string().max(STUDIO_LIMITS.excerpt).optional(),
  bodyMd: z.string().optional(),
  tags: z.array(z.string().regex(TAG_PATTERN)).max(STUDIO_LIMITS.tags),
  featuredImageUrl: z.string().url().optional(),
  imageAlt: z.string().max(160).optional(),
});
export type StudioDraftBody = z.infer<typeof StudioDraftBody>;

export const StudioSubmitReadiness = z.object({
  title: z.boolean(),
  category: z.boolean(),
  bodyWords: z.boolean(),
  excerpt: z.boolean(),
  featuredImage: z.boolean(),
  tags: z.boolean(),
});
export type StudioSubmitReadiness = z.infer<typeof StudioSubmitReadiness>;

/** Verbatim checklist copy, in display order. */
export const STUDIO_READINESS_LABELS: Record<keyof StudioSubmitReadiness, string> = {
  title: 'Title added',
  category: 'Category selected',
  bodyWords: 'Body ≥ 150 words',
  excerpt: 'Excerpt written',
  featuredImage: 'Featured image attached',
  tags: 'At least 2 tags',
};

/** The three gates that must pass before a draft can be submitted for review. */
export const STUDIO_REQUIRED_READINESS = ['title', 'category', 'bodyWords'] as const;
export const STUDIO_OPTIONAL_READINESS = ['excerpt', 'featuredImage', 'tags'] as const;

export function isReadyToSubmit(readiness: StudioSubmitReadiness): boolean {
  return STUDIO_REQUIRED_READINESS.every((key) => readiness[key] === true);
}

export const StudioItem = z.object({
  id: Uuid,
  title: z.string().nullable(),
  slugPath: z.string().nullable(),
  category: BlogCategorySchema.nullable(),
  excerpt: z.string().nullable(),
  bodyMd: z.string().nullable(),
  tags: z.array(z.string()),
  featuredImageUrl: z.string().nullable(),
  imageAlt: z.string().nullable(),
  status: ContentStatusSchema,
  readiness: StudioSubmitReadiness,
  readMinutes: z.number().int().nonnegative().nullable(),
  updatedAt: IsoDateTime,
  reviewerNote: z.string().nullable(),
});
export type StudioItem = z.infer<typeof StudioItem>;

/** The verified-blogger badge, granted by an administrator. */
export const StudioStatus = z.object({
  verified: z.boolean(),
  verifiedAt: IsoDateTime.nullable(),
  displayName: z.string(),
});
export type StudioStatus = z.infer<typeof StudioStatus>;

export const StudioImageUploadRequest = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  sizeBytes: z.number().int().positive().max(STUDIO_LIMITS.imageMaxBytes),
});
export type StudioImageUploadRequest = z.infer<typeof StudioImageUploadRequest>;

export const StudioImageUploadResponse = z.object({
  data: z.object({
    uploadUrl: z.string().url(),
    objectKey: z.string(),
    publicUrl: z.string().url(),
    expiresAt: IsoDateTime,
  }),
});
export type StudioImageUploadResponse = z.infer<typeof StudioImageUploadResponse>;
