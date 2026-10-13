import type { Logger, MaintenanceRepo, Summary } from '../ports';

/**
 * `media_scan` (Task 92) — hourly validation sweep over user-uploaded media
 * references. Detection, not quarantine: flagging or hiding content needs a
 * moderation UI that does not exist, and a sweep that mutates rows on a
 * heuristic is worse than one that reports. Violations land in the log (ids
 * and field names only — never the offending value, which could be attacker-
 * controlled bytes) and in the summary counters, where the admin dashboard's
 * observability picks them up.
 *
 * Two rules, both structural:
 *  1. `profiles.avatar_key` must match `^avatars/[A-Za-z0-9._-]+$` — the prefix
 *     the presign flow issues, with no traversal (`..`), no slashes beyond the
 *     prefix, no absolute paths, no query strings.
 *  2. `content_items.featured_image_url` must be null or same-origin with
 *     `R2_PUBLIC_BASE_URL`: a featured image pointing at a third-party host is
 *     either a mistake or an exfil/tracking vector embedded in a public page.
 */

export const AVATAR_KEY_PATTERN = /^avatars\/[A-Za-z0-9._-]+$/;

/** Pure: the two validation rules, exported for tests. */
export function isValidAvatarKey(key: string): boolean {
  return AVATAR_KEY_PATTERN.test(key);
}

export function isAllowedImageUrl(url: string, allowedOrigin: string): boolean {
  try {
    return new URL(url).origin === new URL(allowedOrigin).origin;
  } catch {
    // An unparseable URL is by definition not on the allow-list.
    return false;
  }
}

export interface MediaScanDeps {
  repo: Pick<MaintenanceRepo, 'listAvatarKeys' | 'listFeaturedImageUrls'>;
  r2PublicBaseUrl: string;
  logger: Logger;
}

export async function runMediaScan(deps: MediaScanDeps): Promise<Summary> {
  const avatars = await deps.repo.listAvatarKeys();
  const images = await deps.repo.listFeaturedImageUrls();

  let avatarViolations = 0;
  for (const row of avatars) {
    if (isValidAvatarKey(row.avatarKey)) continue;
    avatarViolations += 1;
    deps.logger.warn('media_scan: avatar key rejected by the structural rule', {
      profileId: row.id,
      field: 'avatar_key',
    });
  }

  let imageViolations = 0;
  for (const row of images) {
    if (isAllowedImageUrl(row.featuredImageUrl, deps.r2PublicBaseUrl)) continue;
    imageViolations += 1;
    deps.logger.warn('media_scan: featured image URL outside the R2 origin', {
      contentItemId: row.id,
      field: 'featured_image_url',
    });
  }

  const violations = avatarViolations + imageViolations;
  return {
    task: 'media_scan',
    affected: violations,
    detail: {
      avatarsChecked: avatars.length,
      imagesChecked: images.length,
      avatarViolations,
      imageViolations,
      violations,
    },
  };
}
