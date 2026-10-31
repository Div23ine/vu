import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { MfaSetupPanel } from '../../_components/mfa-setup-panel';
import { safeNextPath } from '../../_lib/next-path';
import '../../../_styles/auth.css';

/**
 * `/login/mfa/setup` (Phase 2) — forced first-sign-in MFA SETUP.
 *
 * The API lands the browser here after `GET /auth/magic-link/verify` finds an
 * UNENROLLED account that must enrol before its first full session:
 * `?deadline=` (epoch ms when the admin 5-minute window closes; absent for
 * untimed normal-user enrolment), `?to=` (the SERVER-masked email) and
 * `?next=` (sanitised landing path). The pre-MFA session itself lives in the
 * HttpOnly `vv_mfa` cookie; without it this page has nothing to enrol and
 * says so instead of rendering a dead form. Enforcement of the window is the
 * API's job — `deadline` only drives the visible countdown.
 */

/** MFA challenge cookie (HttpOnly). Mirrors the API's COOKIE_NAMES.mfaChallenge. */
const MFA_CHALLENGE_COOKIE = 'vv_mfa';

/** Longest masked-email string we will echo back into the page copy. */
const MAX_TO_LENGTH = 254;

export const metadata: Metadata = {
  title: 'Set up two-factor authentication',
  robots: { index: false },
};

interface MfaSetupPageProps {
  searchParams: Promise<{ deadline?: string; to?: string; next?: string }>;
}

/** Strict epoch-ms parse: digits only, otherwise the deadline is dropped. */
function parseDeadline(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,15}$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

export default async function MfaSetupPage({ searchParams }: MfaSetupPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);

  if (cookieStore.get(MFA_CHALLENGE_COOKIE) === undefined) {
    return (
      <main className="vv-auth-card" aria-labelledby="vvSetupMissingTitle">
        <header className="vv-auth-head">
          <span className="vv-brand">
            <span className="vv-brand-mark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.svg" alt="" />
            </span>
            <span className="vv-brand-name">VUNVAULT</span>
          </span>
          <h1 className="vv-auth-title" id="vvSetupMissingTitle">
            No active sign-in
          </h1>
          <p className="vv-auth-sub">
            There is no setup session to complete — it either expired or was never started.
          </p>
        </header>
        <Link className="vv-submit" id="vvSetupBackToSignIn" href="/login">
          <span className="vv-submit-label">Back to sign in</span>
        </Link>
      </main>
    );
  }

  const to =
    typeof params.to === 'string' && params.to.length > 0 && params.to.length <= MAX_TO_LENGTH
      ? params.to
      : null;

  return (
    <MfaSetupPanel
      deadlineEpochMs={parseDeadline(params.deadline)}
      to={to}
      next={safeNextPath(params.next)}
    />
  );
}
