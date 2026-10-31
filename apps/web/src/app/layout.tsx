import type { Metadata, Viewport } from 'next';
import { tokens } from '@vunvault/ui';
import { env } from '../env';
import { inter } from '../lib/fonts';
import { JsonLd } from '../lib/json-ld';
import {
  BRAND_ASSETS,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  organisationJsonLd,
  webSiteJsonLd,
} from '../lib/seo';
import { Providers } from './providers';
import './globals.css';

/**
 * Root layout.
 *
 * CONVENTIONS FOR EVERY WEB TASK — these are the rules the rest of Layer L5–L7 is
 * written against, and they are repeated here rather than in a document because
 * this is the file every route renders through.
 *
 * 1. App Router only. Server components by default; add `"use client"` only where
 * state, effects or a browser API genuinely require it. A client boundary is a
 * bundle cost and a hydration risk, so it is earned, not assumed.
 * 2. A Cloudflare Worker is the target (`@opennextjs/cloudflare`). Pages and route
 * handlers run Next's Node.js runtime on workerd, so the Node builtins workerd
 * provides (`node:crypto`, `Buffer`, `node:stream`, …) are available — but there
 * is still no filesystem and no child process, so keep reaching for Web APIs
 * (`fetch`, `crypto.subtle`, `URL`) first. Never declare
 * `export const runtime = "edge"`: the adapter does not support the Edge
 * runtime for pages or route handlers. `src/middleware.ts` is the one file that
 * must stay Web-only, because Next always compiles middleware to the edge bundle.
 * 3. No `localStorage`, `sessionStorage` or IndexedDB for auth, consent or content.
 * Session state lives in HttpOnly cookies set by the API; ephemeral UI state
 * lives in memory and in the TanStack Query cache.
 * 4. Every screen is a React route. No `.html` file exists anywhere in this app —
 * the design's pages were translated, not copied.
 * 5. Data comes from the API through hooks built on `apiFetch` . Each hook
 * carries a `// TODO(backend-contract)` comment above it until the endpoint it
 * reads is verified against the contracts package.
 *
 * Accessibility rules that apply to every component, not just this file: a visible
 * focus state on everything interactive, `aria-label` on every icon-only button,
 * `role="dialog"` + `aria-modal` + a focus trap + Escape-to-close on every dialog,
 * and a `prefers-reduced-motion` fallback on every animation that disables motion
 * without breaking the layout.
 */

/**
 * Site-wide metadata defaults.
 *
 * `metadataBase` is what makes every relative `openGraph.url`, image path and
 * canonical resolve to the real origin; it is built from the one validated
 * `NEXT_PUBLIC_SITE_URL` rather than a literal, so staging and production cannot
 * disagree with their own sitemap.
 *
 * Two things are deliberately NOT set here:
 *
 * - **No `alternates.canonical`.** Metadata inherits down the tree, so a canonical
 *   on the root layout would be inherited by every route and canonicalise the
 *   entire site to `/`. Each page declares its own (see `lib/seo.ts`).
 * - **No `openGraph.url`.** Next derives it from `metadataBase` plus the current
 *   pathname, which is correct per page; a literal here would be inherited too.
 *
 * `robots` defaults to indexable, and the private groups (`(auth)`, `(authed)`,
 * `(marketing)/checkout`) opt out at their layout level.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'vunvault',
    'penetration testing',
    'vulnerability assessment',
    'attack surface management',
    'cybersecurity Kenya',
    'SACCO cyber risk',
    'M-Pesa API security',
    'security compliance assessment',
  ],
  category: 'cybersecurity',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: SITE_LOCALE,
    images: [
      {
        url: BRAND_ASSETS.ogImage,
        width: BRAND_ASSETS.ogWidth,
        height: BRAND_ASSETS.ogHeight,
        alt: BRAND_ASSETS.ogAlt,
      },
    ],
  },
  // No `site`/`creator` handle: the repository publishes no social profiles, and
  // a wrong handle is worse than none. Add both once profiles exist
  // (`docs/seo-runbook.md`).
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [BRAND_ASSETS.ogImage],
  },
};

/**
 * The theme colour comes from the design tokens, not from a literal: `tokens.ts` is
 * the only TypeScript file in the repository allowed to hold a hex value, and a
 * test there fails if it drifts from `tokens.css`.
 */
export const viewport: Viewport = {
  themeColor: tokens.color.paper,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-paper text-neutral-900 antialiased">
        {/*
          Entity graph: one Organization node and one WebSite node referencing it,
          emitted on every page so any URL an answer engine lands on carries the
          same "what is vunvault" facts. Rendered as data blocks — see
          `lib/json-ld.tsx` for why they are not nonced under this site's CSP.
        */}
        <JsonLd data={organisationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
