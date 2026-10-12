import type { Metadata, Viewport } from 'next';
import { tokens } from '@vunvault/ui';
import { env } from '../env';
import { inter } from '../lib/fonts';
import { Providers } from './providers';
import './globals.css';

// 👇 THIS IS THE MISSING LINE REQUIRED FOR CLOUDFLARE PAGES
export const runtime = 'edge';

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
 * 2. Cloudflare Pages is the target. Every route handler and dynamic route must be
 *    edge-compatible: no `fs`, no `node:crypto`, no `Buffer`. Dynamic routes declare
 *    `export const runtime = "edge"`.
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

export const viewport: Viewport = {
  themeColor: tokens.color.paper,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper text-ink antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}