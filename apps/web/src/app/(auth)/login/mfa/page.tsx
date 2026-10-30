import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { MfaMethodSchema, type MfaMethod } from '@vunvault/contracts';
import { MfaPanel } from '../_components/mfa-panel';
import { safeNextPath } from '../_lib/next-path';
import '../../_styles/auth.css';

/**
 * `/login/mfa` (Phase 1 magic-link work order) — the second-factor PAGE.
 *
 * The API lands the browser here after `GET /auth/magic-link/verify` mints
 * the pre-MFA session (and after an OAuth staff sign-in that still needs a
 * second factor): `?methods=` (CSV of the offered challenges), `?to=` (the
 * SERVER-masked email — the full address never travels in a URL) and
 * `?next=` (sanitised landing path). The pre-MFA session itself lives in the
 * HttpOnly `vv_mfa` cookie; without it this page has nothing to verify and
 * says so instead of rendering a dead form.
 */

/** MFA challenge cookie (HttpOnly). Mirrors the API's COOKIE_NAMES.mfaChallenge. */
const MFA_CHALLENGE_COOKIE = 'vv_mfa';

/** Longest masked-email string we will echo back into the page copy. */
const MAX_TO_LENGTH = 254;

export const metadata: Metadata = {
  title: 'Two-factor verification',
  robots: { index: false },
};

interface MfaPageProps {
  searchParams: Promise<{ methods?: string; to?: string; next?: string }>;
}

export default async function MfaPage({ searchParams }: MfaPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);

  if (cookieStore.get(MFA_CHALLENGE_COOKIE) === undefined) {
    return (
      <main className="vv-auth-card" aria-labelledby="vvMfaMissingTitle">
        <header className="vv-auth-head">
          <span className="vv-brand">
            <span className="vv-brand-mark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.svg" alt="" />
            </span>
            <span className="vv-brand-name">VUNVAULT</span>
          </span>
          <h1 className="vv-auth-title" id="vvMfaMissingTitle">
            No active sign-in
          </h1>
          <p className="vv-auth-sub">
            There is no verification session to complete — it either expired or was never started.
          </p>
        </header>
        <Link className="vv-submit" id="vvBackToSignIn" href="/login">
          <span className="vv-submit-label">Back to sign in</span>
        </Link>
      </main>
    );
  }

  // Only known challenge types survive; anything else is dropped. An absent
  // (but cookied) visit falls back to the full list — the API refuses
  // methods the account does not have, exactly as the old dialog did.
  const offered = (params.methods ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is MfaMethod =>
      (MfaMethodSchema.options as readonly string[]).includes(value),
    );
  const methods: MfaMethod[] =
    offered.length > 0 ? offered : (['totp', 'email_otp', 'webauthn'] as MfaMethod[]);
  const to =
    typeof params.to === 'string' && params.to.length > 0 && params.to.length <= MAX_TO_LENGTH
      ? params.to
      : null;

  return <MfaPanel methods={methods} to={to} next={safeNextPath(params.next)} />;
}
