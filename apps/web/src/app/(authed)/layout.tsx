/**
 * `(authed)` — everything behind a session: `/onboarding`, `/portal/*`, `/admin/*`.
 *
 * Pass-through for now. an earlier iteration's edge middleware guards the group; a session that
 * has expired between navigations is handled there rather than in each layout, so
 * there is one place that decides what "not signed in" means.
 */
import type { Metadata } from 'next';
/**
 * Everything in `(authed)` is behind a session, so it must never appear in an
 * index. Declared once at the group level because most of these pages are client
 * components (`/admin/*`, `/portal/scans/[id]`, `/portal/studio/edit/[id]`) and
 * cannot export metadata themselves. The group is also disallowed in
 * `robots.ts`, so this is the second of two independent lines of defence.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
