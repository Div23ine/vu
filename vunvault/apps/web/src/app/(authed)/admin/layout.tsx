import { requireSession } from '../../../lib/server-session';
import { AdminFooter } from './_components/admin-footer';
import { AdminHeader } from './_components/admin-header';
import './_styles/admin-chrome.css';

/**
 * `(authed)/admin` — the Command Center: `/admin` (dashboard),
 * `/admin/scan-queue`, `/admin/zero-day`, `/admin/users`, `/admin/content`,
 * `/admin/audit`, `/admin/profile`, `/admin/payments`.
 *
 * Task 46 chrome: the server-side STAFF guard runs first — `requireSession`
 * redirects anonymous visitors to `/login`, client-role sessions to
 * `/forbidden`, and staff without MFA back to `/login?error=mfa_required`
 * (Task 43's placeholder). Nothing in this layout may assume a permission:
 * each page checks its own with `<Can>` / `requireSession({ permission })`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession({ staff: true });

  return (
    <div className="min-h-screen bg-paper text-neutral-900 flex flex-col">
      <AdminHeader />
      <main className="adm-main">{children}</main>
      <AdminFooter />
    </div>
  );
}
