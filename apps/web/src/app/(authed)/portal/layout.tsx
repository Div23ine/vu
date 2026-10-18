import { requireSession } from '../../../lib/server-session';
import { PortalFooter } from './_components/portal-footer';
import { PortalHeader } from './_components/portal-header';
import { RequestPenTestDialog } from './_components/request-pentest-dialog';

/**
 * `(authed)/portal` — the client portal: `/portal` (scans), `/portal/billing`,
 * `/portal/security` (Password Manager), `/portal/profile`, `/portal/advisories`,
 * `/portal/studio`, `/portal/academy`, `/portal/scanner`.
 *
 * an earlier iteration chrome: the server-side session guard runs first (`requireSession`
 * redirects anonymous visitors to `/login`), then the sticky header, the
 * footer and the single Request PenTest dialog instance the header's CTA and
 * drawer item both open.
 *
 * Staff sessions are allowed through — they may preview the portal; no
 * redirect. The release lock is enforced by the API, not here: a scan the
 * review gate has not released is not returned to this app at all (an earlier iteration's
 * `clientVisibleWhere`).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireSession({});

  return (
    <div className="min-h-screen bg-paper text-neutral-900 flex flex-col">
      <PortalHeader />
      <main className="flex-1">{children}</main>
      <PortalFooter />
      <RequestPenTestDialog />
    </div>
  );
}
