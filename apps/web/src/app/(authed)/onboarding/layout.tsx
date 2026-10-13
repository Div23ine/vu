import { redirect } from 'next/navigation';
import { SiteFooter } from '../../(marketing)/_components/site-footer';
import { SiteHeader } from '../../(marketing)/_components/site-header';
import { isStaffRole } from '../../../lib/permissions';
import { requireSession } from '../../../lib/server-session';

/**
 * `(authed)/onboarding` — the client intake wizard (Tasks 64–65).
 *
 * The catalogue pins the chrome: `requireSession()` first, then the MARKETING
 * header/footer (footer variant `home`) — no portal chrome. Staff never see
 * this page: the wizard completes a CLIENT profile, so any staff role is
 * redirected to `/admin` right here (the edge middleware only enforces the
 * session, not the role split inside `(authed)`).
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  if (isStaffRole(user.role)) redirect('/admin');

  return (
    <div className="min-h-screen bg-paper text-neutral-900 flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter variant="home" />
    </div>
  );
}
