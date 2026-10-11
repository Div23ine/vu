/**
 * Slugs for the Content Studio.
 *
 * A slug is part of a public URL, so it is generated server-side from the title
 * (or supplied by the author within `SLUG_PATTERN`) and made unique by suffixing
 * `-2`, `-3`, … — never by mutating the words, and never by exposing another
 * item's id.
 */

import { SLUG_PATTERN } from '@vunvault/contracts';

/** Long enough to be readable, short enough to survive a share card. */
export const SLUG_MAX_LENGTH = 60;

/** The path prefix a Studio draft is published under. */
export const BLOG_PATH_PREFIX = '/blog/';

/** `Kenya's State House Cyber Audit!` → `kenya-state-house-cyber-audit` */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    // Drop combining marks so `é` becomes `e` rather than a percent-escape.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((word) => word !== '')
    .join('-');

  const trimmed = base.length > SLUG_MAX_LENGTH ? base.slice(0, SLUG_MAX_LENGTH) : base;
  // A suffix must not be cut off mid-word.
  return trimmed.replace(/-+$/g, '');
}

/** True when the string is already a valid slug and can be used as given. */
export function isExplicitSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length <= SLUG_MAX_LENGTH;
}

/** `/blog/<slug>` */
export function blogSlugPath(slug: string): string {
  return `${BLOG_PATH_PREFIX}${slug}`;
}

/**
 * The candidate slug for one attempt: `<base>` on the first, then `<base>-2`,
 * `<base>-3`, … The caller checks each against the database and stops at the first
 * free one; the sequence lives here so the suffix rule cannot drift between the
 * Studio and its tests.
 */
export function nextSlugCandidate(base: string, attempt: number): string {
  const stem = base === '' ? 'untitled' : base;
  return attempt <= 1 ? stem : `${stem}-${attempt}`;
}

/** How many collisions to tolerate before giving up. */
export const SLUG_MAX_ATTEMPTS = 100;

/** A stable fallback when a draft has no title yet. */
export function draftSlugSeed(itemId: string): string {
  return `untitled-${itemId.replace(/-/g, '').slice(0, 8)}`;
}
