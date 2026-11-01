'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, Timer } from 'lucide-react';
import { Button } from '@vunvault/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@vunvault/ui';
import { useSession } from '../lib/session';
import { safeNextPath } from '../app/(auth)/login/_lib/next-path';

/**
 * The mandatory first-login MFA enrolment popup (work order Task 2b).
 *
 * An administrator's first magic-link sign-in now lands on the HOMEPAGE with a
 * real (aal1) session rather than on a dedicated setup screen, so the enrolment
 * ceremony has to come to them. This component is mounted once, in the root
 * `Providers`, and renders whenever the session carries an armed
 * `mfaSetupDeadline`.
 *
 * Three things make it trustworthy rather than decorative:
 *
 * 1. The deadline is the SERVER's. It arrives on the session view straight from
 *    `profiles.mfa_setup_deadline`; nothing here reads a query string a browser
 *    could have edited, and the countdown is display-only.
 * 2. It cannot be dismissed. `dismissible={false}` + `hideClose` means Escape
 *    and backdrop clicks do nothing — the only control is the one that starts
 *    enrolment. The work order calls this popup mandatory, so it is.
 * 3. Expiry is enforced elsewhere. When the clock runs out the API's own
 *    middleware starts rejecting the session, so the worst a stale tab can do is
 *    show an out-of-date countdown. This component simply stops pretending the
 *    window is open and tells the truth.
 *
 * It stays out of the way on the enrolment screen itself, where the ceremony is
 * already on the page.
 */

/** Paths where the popup must not render — the ceremony is already on screen. */
const SUPPRESSED_PREFIXES = ['/login/mfa/setup', '/login/mfa'] as const;

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MfaSetupNotice() {
  const { user, refetch } = useSession();
  const pathname = usePathname();

  const deadlineEpochMs = useMemo(() => {
    const raw = user?.mfaSetupDeadline;
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.mfaSetupDeadline]);

  // `null` until the first tick so SSR and the initial client render agree and
  // there is no hydration mismatch on the countdown text.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (deadlineEpochMs === null) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((deadlineEpochMs - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineEpochMs]);

  // The moment the window closes, re-read the session. The API now rejects it,
  // so this resolves to `null`, the popup unmounts and the app's own
  // unauthenticated handling takes the user back to the sign-in screen — rather
  // than leaving a live-looking session sitting in the cache for a minute.
  useEffect(() => {
    if (remaining === 0) refetch();
  }, [remaining, refetch]);

  if (deadlineEpochMs === null || remaining === null) return null;

  const at = pathname ?? '';
  if (SUPPRESSED_PREFIXES.some((prefix) => at.startsWith(prefix))) return null;

  const expired = remaining === 0;
  const next = safeNextPath(at);
  const setupHref = `/login/mfa/setup?deadline=${deadlineEpochMs}${
    next === null ? '' : `&next=${encodeURIComponent(next)}`
  }`;

  return (
    <Dialog open>
      <DialogContent
        size="sm"
        dismissible={false}
        hideClose
        aria-labelledby="vvMfaSetupNoticeTitle"
        aria-describedby="vvMfaSetupNoticeDesc"
        data-testid="mfa-setup-notice"
      >
        <DialogHeader>
          <span
            className="inline-grid size-9 place-items-center rounded-full bg-critical/16 text-critical"
            aria-hidden="true"
          >
            {expired ? <ShieldAlert size={18} /> : <Timer size={18} />}
          </span>
          <DialogTitle id="vvMfaSetupNoticeTitle">
            {expired ? 'Setup window closed' : 'Set up two-factor authentication'}
          </DialogTitle>
          <DialogDescription id="vvMfaSetupNoticeDesc">
            {expired
              ? 'The five minutes allowed for enrolment have passed and this session is no longer valid. A super administrator can unblock your account, after which signing in again restarts the window.'
              : 'Your account needs an authenticator app before it can reach the admin console. You have the time shown below to enrol — the countdown is enforced by the server, not by this page.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-[22px] pb-5">
          {expired ? (
            <Button asChild variant="primary" className="w-full">
              <Link href="/login">Sign in again</Link>
            </Button>
          ) : (
            <>
              <p
                className="text-center font-mono text-4xl tabular-nums tracking-tight text-white"
                data-testid="mfa-setup-countdown"
                aria-live="polite"
              >
                {formatCountdown(remaining)}
              </p>
              <p className="mt-1 text-center text-xs text-slate-muted">
                minutes : seconds remaining
              </p>
              <Button asChild variant="primary" className="mt-5 w-full">
                <Link href={setupHref} data-testid="mfa-setup-cta">
                  Set up MFA now
                </Link>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
