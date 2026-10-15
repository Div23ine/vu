import type { Metadata, Viewport } from 'next';
import { tokens } from '@vunvault/ui';
import { env } from '../env';
import { inter } from '../lib/fonts';
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
 *    state, effects or a browser API genuinely require it. A client boundary is a
 *    bundle cost and a hydration risk, so it is earned, not assumed.
 * 2. A Cloudflare Worker is the target (`@opennextjs/cloudflare`). Pages and route
 *    handlers run Next's Node.js runtime on workerd, so the Node builtins workerd
 *    provides (`node:crypto`, `Buffer`, `node:stream`, …) are available — but there
 *    is still no filesystem and no child process, so keep reaching for Web APIs
 *    (`fetch`, `crypto.subtle`, `URL`) first. Never declare
 *    `export const runtime = "edge"`: the adapter does not support the Edge
 *    runtime for pages or route handlers. `src/middleware.ts` is the one file that
 *    must stay Web-only, because Next always compiles middleware to the edge bundle.
 * 3. No `localStorage`, `sessionStorage` or IndexedDB for auth, consent or content.
 *    Session state lives in HttpOnly cookies set by the API; ephemeral UI state
 *    lives in memory and in the TanStack Query cache.
 * 4. Every screen is a React route. No `.html` file exists anywhere in this app —
 *    the prototype's pages were translated, not copied.
 * 5. Data comes from the API through hooks built on `apiFetch` (Task 7). Each hook
 *    carries a `// TODO(backend-contract)` comment above it until the endpoint it
 *    reads is verified against the contracts package.
 *
 * Accessibility rules that apply to every component, not just this file: a visible
 * focus state on everything interactive, `aria-label` on every icon-only button,
 * `role="dialog"` + `aria-modal` + a focus trap + Escape-to-close on every dialog,
 * and a `prefers-reduced-motion` fallback on every animation that disables motion
 * without breaking the layout.
 */

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'VUNVAULT — We Find The Cracks Before They Do',
    template: '%s — VUNVAULT',
  },
  description:
    'Africa-rooted, worldwide penetration testing, vulnerability assessments and cybersecurity education.',
  openGraph: {
    siteName: 'VUNVAULT',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
