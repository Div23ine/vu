import { describe, expect, it } from 'vitest';
import { isAllowedImageUrl, isValidAvatarKey, runMediaScan } from './media-scan';
import type { Logger, MaintenanceRepo } from '../ports';

const R2_BASE = 'https://cdn.vunvault.com';

function makeLogger() {
  const warnings: Array<{ message: string; fields?: Record<string, unknown> }> = [];
  const logger: Logger = {
    info: () => undefined,
    warn: (message, fields) => warnings.push({ message, fields }),
    error: () => undefined,
    debug: () => undefined,
  };
  return { logger, warnings };
}

describe('avatar key rule', () => {
  it.each([
    'avatars/9f1c2ab4-0d3e-4f5a-8b7c-6d5e4f3a2b1c.png',
    'avatars/photo_2026.webp',
    'avatars/a.svg',
  ])('accepts %s', (key) => {
    expect(isValidAvatarKey(key)).toBe(true);
  });

  it.each([
    'avatar/missing-prefix.png',
    'avatars/../secrets/key.pem',
    'avatars/nested/path.png',
    '/avatars/absolute.png',
    'avatars/query.png?x=1',
    'avatars/spaces in name.png',
    '',
  ])('rejects %s', (key) => {
    expect(isValidAvatarKey(key)).toBe(false);
  });
});

describe('featured image URL rule', () => {
  it('accepts the R2 origin', () => {
    expect(isAllowedImageUrl(`${R2_BASE}/content/hero.png`, R2_BASE)).toBe(true);
  });

  it('rejects third-party origins, unparseable values and near-misses', () => {
    expect(isAllowedImageUrl('https://evil.example/track.gif', R2_BASE)).toBe(false);
    expect(isAllowedImageUrl('https://cdn.vunvault.com.evil.example/x.png', R2_BASE)).toBe(false);
    expect(isAllowedImageUrl('not a url', R2_BASE)).toBe(false);
    expect(isAllowedImageUrl('//cdn.vunvault.com/x.png', R2_BASE)).toBe(false);
  });
});

describe('runMediaScan', () => {
  function makeHarness(
    avatars: Array<{ id: string; avatarKey: string }>,
    images: Array<{ id: string; featuredImageUrl: string }>,
  ) {
    const repo = {
      async listAvatarKeys() {
        return avatars;
      },
      async listFeaturedImageUrls() {
        return images;
      },
    } as Pick<MaintenanceRepo, 'listAvatarKeys' | 'listFeaturedImageUrls'>;
    return runMediaScan({ repo, r2PublicBaseUrl: R2_BASE, logger: makeLogger().logger }).then(
      (summary) => ({ summary }),
    );
  }

  it('counts clean rows and reports zero violations', async () => {
    const { summary } = await makeHarness(
      [{ id: 'p1', avatarKey: 'avatars/p1.png' }],
      [{ id: 'c1', featuredImageUrl: `${R2_BASE}/content/hero.png` }],
    );
    expect(summary).toEqual({
      task: 'media_scan',
      affected: 0,
      detail: {
        avatarsChecked: 1,
        imagesChecked: 1,
        avatarViolations: 0,
        imageViolations: 0,
        violations: 0,
      },
    });
  });

  it('flags traversal keys and foreign origins without logging the values', async () => {
    const { logger, warnings } = makeLogger();
    const repo = {
      async listAvatarKeys() {
        return [{ id: 'p2', avatarKey: 'avatars/../secrets/key.pem' }];
      },
      async listFeaturedImageUrls() {
        return [{ id: 'c2', featuredImageUrl: 'https://evil.example/track.gif' }];
      },
    } as Pick<MaintenanceRepo, 'listAvatarKeys' | 'listFeaturedImageUrls'>;

    const summary = await runMediaScan({ repo, r2PublicBaseUrl: R2_BASE, logger });
    expect(summary.affected).toBe(2);
    expect(summary.detail).toMatchObject({
      avatarViolations: 1,
      imageViolations: 1,
      violations: 2,
    });

    // The offending VALUE must never reach a log sink — ids and field names only.
    for (const warning of warnings) {
      const serialized = JSON.stringify(warning.fields ?? {});
      expect(serialized).not.toContain('secrets/key.pem');
      expect(serialized).not.toContain('evil.example');
    }
    expect(warnings.map((warning) => warning.fields?.field)).toEqual([
      'avatar_key',
      'featured_image_url',
    ]);
  });
});
