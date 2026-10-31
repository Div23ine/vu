/**
 * `(auth)` — the unauthenticated flows: `/login`, `/signup`, `/accept-invite`,
 * `/newsletter/confirm`.
 *
 * an earlier iteration turns the pass-through into the full-screen auth shell: the
 * animated background plus a centred overlay the cards sit in. No marketing
 * chrome — the edge middleware keeps signed-in visitors away.
 */
import type { Metadata } from 'next';
import { AuthBackground } from './_components/auth-background';

/**
 * The whole `(auth)` group is a flow, not content: noindex at the group level so
 * it covers the client components in it (`/signup/enroll` cannot export metadata
 * of its own). These paths stay CRAWLABLE — they are not in `robots.ts`'s
 * disallow list — because a page Google cannot fetch is a page whose `noindex`
 * Google never sees.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vv-auth-overlay">
      <AuthBackground />
      {children}
    </div>
  );
}
