import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/**
 * Where the CDN serves user-uploaded and generated images from.
 * We use `||` instead of `??` because an empty string `""` from `.env.local`
 * is not nullish, but Next.js will throw "Expected a non-empty string"
 * if `hostname` in `remotePatterns` is empty.
 */
const ASSETS_HOST = process.env.NEXT_PUBLIC_R2_HOST || 'assets.vunvault.com';

/**
 * Real data is the default; the MSW mock layer is opt-in and cannot reach a
 * deployed environment by accident.
 */
if (
  process.env.NEXT_PUBLIC_API_MOCKING === 'enabled' &&
  process.env.NODE_ENV === 'production' &&
  process.env.VUNVAULT_ALLOW_MOCK_BUILD !== 'true'
) {
  throw new Error(
    [
      'Refusing to build with the MSW mock layer enabled.',
      '',
      'NEXT_PUBLIC_API_MOCKING=enabled was inlined into a production build, which',
      'would deploy a site that answers every API call from local fixtures instead',
      'of the real API.',
      '',
      'The value almost always comes from an env FILE, not your shell: Next.js loads',
      'apps/web/.env.local (and .env.production / .env.production.local) into',
      'process.env BEFORE this config runs, so a plain `unset NEXT_PUBLIC_API_MOCKING`',
      'will NOT clear it. Edit the file that sets it and disable it there:',
      '',
      '  # in apps/web/.env.local — change the line, or delete it:',
      '  NEXT_PUBLIC_API_MOCKING=disabled',
      '  # then rebuild:',
      '  pnpm --filter web cf:build',
      '',
      '(The dev template apps/web/.env.example ships it as `enabled` on purpose — the',
      'mock layer is a local-dev convenience; a production build must turn it off.)',
      '',
      'To build a deliberately mocked throwaway preview, opt in explicitly:',
      '',
      '  VUNVAULT_ALLOW_MOCK_BUILD=true NEXT_PUBLIC_API_MOCKING=enabled \\',
      '    pnpm --filter web cf:build',
    ].join('\n'),
  );
}

/**
 * The MSW service-worker script must never ship in a real build.
 */
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled' &&
  existsSync(path.join(process.cwd(), 'public', 'mockServiceWorker.js'))
) {
  throw new Error(
    [
      'Refusing to build with public/mockServiceWorker.js present.',
      '',
      'That file is the MSW service worker. It is gitignored, but `msw init public`',
      'is a documented local pre-step, so it is sitting in this working tree and',
      'would be published to the production origin — served without a CSP (the',
      'middleware matcher excludes it) and registerable by any future injection.',
      '',
      'Delete it and rebuild:',
      '',
      '  rm apps/web/public/mockServiceWorker.js && pnpm --filter web cf:build',
      '',
      'Regenerate it for local mock work with `pnpm --filter web exec msw init public --save`.',
    ].join('\n'),
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@vunvault/ui', '@vunvault/lib', '@vunvault/contracts'],
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: ASSETS_HOST }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Note: The webpack extensionAlias block has been removed.
  // Turbopack handles TS compilation natively now that the .js extensions
  // have been removed from the monorepo source files.

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;

/**
 * Local development only: expose the Cloudflare bindings declared in
 * `wrangler.jsonc` to server code running under `next dev`.
 */
if (process.env.NODE_ENV !== 'production') {
  void initOpenNextCloudflareForDev();
}
