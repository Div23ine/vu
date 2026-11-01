import { randomBytes } from 'node:crypto';
import type { SupabaseAdminMfa, TotpEnrollment } from './supabase-admin.js';

/**
 * TOTP enrolment policy — the two values every enrolment surface must agree on,
 * and the retry rule that stops a second attempt from failing forever.
 *
 * ── Issuer ────────────────────────────────────────────────────────────────
 * GoTrue derives the `issuer` from the project's Site URL host when the enroll
 * request omits it (`internal/api/mfa.go`: `url.ParseRequestURI(config.SiteURL)`
 * → `u.Host`). That puts a hostname — whatever happens to be configured — into
 * the authenticator app's account list, and it differs between environments, so
 * the same user's entry reads differently on staging and production. The work
 * order (Task 3c) asks for a real `issuer=`, and the brand name is what every
 * other surface already shows, so it is pinned here.
 *
 * Changing it is safe for existing factors: `issuer` only shapes the
 * `otpauth://` URI at enrolment time, it is not part of the shared secret.
 *
 * ── Friendly-name collision ───────────────────────────────────────────────
 * GoTrue's `validateFactors` rejects a second factor carrying the same
 * `friendly_name` for one user with 422 `mfa_factor_name_conflict`, and it only
 * garbage-collects unverified factors once `MFA.FactorExpiryDuration` has
 * elapsed. So the first failed attempt — a network blip, a closed tab, a wrong
 * code followed by "Try again" — poisons every retry inside that window with a
 * 422 the UI can only render as a generic failure. Left alone it also walks the
 * account towards `MaxEnrolledFactors`, after which enrolment is impossible
 * without an admin unenrolling by hand.
 *
 * The fix is to make the name unique on a *retry* only. `friendly_name` is
 * never shown in the authenticator app (that is the issuer and the account
 * name), so a suffix is invisible to the member; the first attempt keeps the
 * clean product copy.
 */

/** The account label the authenticator app shows next to the email. */
export const TOTP_ISSUER = 'VUNVAULT';

/** Product copy for the factor. Not user-visible in the authenticator app. */
export const TOTP_FRIENDLY_NAME = 'Authenticator app';

/** GoTrue 422s that mean "an earlier attempt of this same enrolment is still there". */
const RETRYABLE_CONFLICT_CODES: ReadonlySet<string> = new Set([
  'mfa_factor_name_conflict',
  'mfa_factor_exists',
]);

/** `Authenticator app · 3f9c1a2b` — a suffix that cannot collide with itself. */
function uniqueFriendlyName(): string {
  return `${TOTP_FRIENDLY_NAME} · ${randomBytes(4).toString('hex')}`;
}

function isFactorNameConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && RETRYABLE_CONFLICT_CODES.has(code);
}

/**
 * Start a TOTP enrolment, retrying once under a unique factor name if GoTrue
 * says the friendly name is taken by a still-unverified earlier attempt.
 *
 * At most two calls: a second conflict means the account has genuinely hit
 * GoTrue's factor ceiling, and retrying further would just burn attempts.
 */
export async function enrollTotp(
  mfa: SupabaseAdminMfa,
  accessToken: string,
): Promise<TotpEnrollment> {
  try {
    return await mfa.enrollTotp(accessToken, TOTP_FRIENDLY_NAME, TOTP_ISSUER);
  } catch (error) {
    if (!isFactorNameConflict(error)) throw error;
    return mfa.enrollTotp(accessToken, uniqueFriendlyName(), TOTP_ISSUER);
  }
}
