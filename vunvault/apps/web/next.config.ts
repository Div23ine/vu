import type { NextConfig } from 'next';

/**
 * Next.js configuration for the marketing site, the client portal and the admin
 * Command Center — one app, three route groups.
 *
 * Two decisions here are security decisions rather than build tuning.
 *
 *  - The security headers below are applied to every route. There is deliberately
 *    NO Content-Security-Policy: a useful CSP for this app needs a per-request
 *    nonce, and nonces are minted by the edge middleware (Task 43). A static CSP
 *    here would either be decorative or would fight the middleware's.
 *  - `poweredByHeader: false`. Advertising the framework and its version is free
 *    reconnaissance for anybody scanning the estate we scan for our clients.
 *
 * Target runtime is Cloudflare Pages (Layer L13), so every route handler and
 * dynamic route must stay edge-compatible: no `fs`, no `node:crypto`, no `Buffer`.
 */

/** Where the CDN serves user-uploaded and generated images from. */
const ASSETS_HOST = process.env.NEXT_PUBLIC_R2_HOST ?? 'assets.vunvault.com';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@vunvault/ui', '@vunvault/lib', '@vunvault/contracts'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: ASSETS_HOST }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

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

  // No redirects: `/logout` is a client route, and the guard redirects live in the
  // edge middleware where they can read the session cookie.
  async redirects() {
    return [];
  },

  // No rewrites: the browser calls the API origin directly, with credentials, so
  // the HttpOnly session cookies are first-party to the API and CORS is exact.
  async rewrites() {
    return [];
  },
};

export default nextConfig;
