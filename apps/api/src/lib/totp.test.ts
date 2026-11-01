import { describe, expect, it, vi } from 'vitest';
import { SupabaseError } from './supabase-admin.js';
import type { SupabaseAdminMfa, TotpEnrollment } from './supabase-admin.js';
import { enrollTotp, TOTP_FRIENDLY_NAME, TOTP_ISSUER } from './totp.js';

/**
 * `lib/totp.ts` — the enrolment policy every surface shares.
 *
 * Two things are pinned here because both are invisible in the happy path and
 * both were live defects: the `issuer` (omitted, GoTrue substitutes the project
 * Site URL host, so the authenticator app shows a hostname that differs between
 * environments) and the friendly-name collision (GoTrue 422s a second factor
 * with a name an unverified earlier attempt already holds, so every "Try again"
 * after a blip failed permanently).
 */

const ENROLMENT: TotpEnrollment = {
  factorId: 'factor-1',
  qrSvg: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>',
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  uri: 'otpauth://totp/VUNVAULT:jane@vunvault.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=VUNVAULT',
};

function fakeMfa(
  impl: (accessToken: string, friendlyName: string, issuer?: string) => Promise<TotpEnrollment>,
): SupabaseAdminMfa {
  return {
    enrollTotp: impl,
    challengeAndVerify: vi.fn(),
    unenroll: vi.fn(),
    listFactors: vi.fn(),
  } as unknown as SupabaseAdminMfa;
}

describe('enrollTotp — issuer', () => {
  it('pins the brand issuer instead of letting GoTrue use the Site URL host', async () => {
    const seen: Array<{ friendlyName: string; issuer: string | undefined }> = [];
    const mfa = fakeMfa(async (_token, friendlyName, issuer) => {
      seen.push({ friendlyName, issuer });
      return ENROLMENT;
    });

    await enrollTotp(mfa, 'access-token');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ friendlyName: TOTP_FRIENDLY_NAME, issuer: TOTP_ISSUER });
    expect(TOTP_ISSUER).toBe('VUNVAULT');
  });

  it('forwards the access token untouched', async () => {
    const enrollTotpFn = vi.fn(
      async (_accessToken: string, _friendlyName: string, _issuer?: string) => ENROLMENT,
    );
    await enrollTotp(fakeMfa(enrollTotpFn), 'the-token');
    expect(enrollTotpFn.mock.calls[0]?.[0]).toBe('the-token');
  });
});

describe('enrollTotp — friendly-name collision retry', () => {
  it('retries once under a different name when the first is taken', async () => {
    const names: string[] = [];
    const mfa = fakeMfa(async (_token, friendlyName) => {
      names.push(friendlyName);
      if (names.length === 1) {
        throw new SupabaseError('mfa_factor_name_conflict', 'A factor with that name exists', 422);
      }
      return ENROLMENT;
    });

    await expect(enrollTotp(mfa, 'access-token')).resolves.toEqual(ENROLMENT);
    expect(names).toHaveLength(2);
    expect(names[0]).toBe(TOTP_FRIENDLY_NAME);
    expect(names[1]).not.toBe(TOTP_FRIENDLY_NAME);
    expect(names[1]?.startsWith(TOTP_FRIENDLY_NAME)).toBe(true);
  });

  it('does not retry twice — a second conflict is a real ceiling', async () => {
    const calls: string[] = [];
    const mfa = fakeMfa(async (_token, friendlyName) => {
      calls.push(friendlyName);
      throw new SupabaseError('mfa_factor_name_conflict', 'still taken', 422);
    });

    await expect(enrollTotp(mfa, 'access-token')).rejects.toBeInstanceOf(SupabaseError);
    expect(calls).toHaveLength(2);
  });

  it('rethrows any other Supabase failure unchanged', async () => {
    const error = new SupabaseError('supabase_error', 'GoTrue is down', 503);
    const mfa = fakeMfa(async () => {
      throw error;
    });
    await expect(enrollTotp(mfa, 'access-token')).rejects.toBe(error);
  });

  it('produces distinct suffixes so repeated retries cannot collide with each other', async () => {
    const names = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const mfa = fakeMfa(async (_token, friendlyName) => {
        if (friendlyName === TOTP_FRIENDLY_NAME) {
          throw new SupabaseError('mfa_factor_name_conflict', 'taken', 422);
        }
        names.add(friendlyName);
        return ENROLMENT;
      });
      await enrollTotp(mfa, 'access-token');
    }
    expect(names.size).toBe(25);
  });
});
