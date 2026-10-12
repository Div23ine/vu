import { http, HttpResponse } from 'msw';
import { TotpVerifyBody } from '@vunvault/contracts';
import { mfaStatus, securityPosture } from '@vunvault/contracts/fixtures/account';

/**
 * Account-security mock handlers (Task 67).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. Status reads come from the contract fixtures (TOTP enabled, one
 * YubiKey, 3 of 10 recovery codes remaining); tests override per scenario
 * with `server.use`. Conventions: the change-password mock accepts
 * `password123` as the current password (the same secret the login mock
 * accepts for the client fixture) and answers `401 invalid_credentials`
 * otherwise; TOTP verify accepts `123456`.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 27):
 *   GET    /api/v1/account/security                       → 200 { data: MfaStatus & { posture } }
 *   POST   /api/v1/account/password                       → 204 | 401 | 422
 *   POST   /api/v1/account/mfa/totp/enroll                → 201 TotpEnrollStart
 *   POST   /api/v1/account/mfa/totp/verify                → 204 | 401 mfa_failed
 *   DELETE /api/v1/account/mfa/totp                       → 204 | 422 last_factor
 *   POST   /api/v1/account/mfa/webauthn/register/options  → 200 { data: options(JSON) }
 *   POST   /api/v1/account/mfa/webauthn/register/verify   → 201 { data: WebauthnKey }
 *   DELETE /api/v1/account/mfa/webauthn/:id               → 204
 *   POST   /api/v1/account/recovery-codes[/regenerate]    → 201 RecoveryCodesResponse
 */

const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

const MOCK_RECOVERY_CODES = [
  'A1B2-C3D4-E5F6',
  'G7H8-J9K1-L2M3',
  'N4P5-Q6R7-S8T9',
  'U1V2-W3X4-Y5Z6',
  'A7B8-C9D1-E2F3',
  'G4H5-J6K7-L8M9',
  'N1P2-Q3R4-S5T6',
  'U7V8-W9X1-Y2Z3',
  'A4B5-C6D7-E8F9',
  'G1H2-J3K4-L5M6',
];

export const securityHandlers = [
  http.get('*/api/v1/account/security', () =>
    HttpResponse.json({ data: { ...mfaStatus, posture: securityPosture } }),
  ),

  http.post('*/api/v1/account/password', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    } | null;
    if (body?.currentPassword !== 'password123') {
      return HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    if (body?.newPassword === 'Breached!Pass1') {
      return HttpResponse.json({ error: 'breached_password' }, { status: 422 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/account/mfa/totp/enroll', () =>
    HttpResponse.json(
      {
        data: {
          factorId: 'factor-mock-totp-01',
          qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
          secret: MOCK_TOTP_SECRET,
          uri: `otpauth://totp/VUNVAULT:jane@example.com?secret=${MOCK_TOTP_SECRET}&issuer=VUNVAULT`,
        },
      },
      { status: 201 },
    ),
  ),

  http.post('*/api/v1/account/mfa/totp/verify', async ({ request }) => {
    const parsed = TotpVerifyBody.safeParse(await request.json().catch(() => null));
    if (parsed.success && parsed.data.code === '123456') {
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
  }),

  http.delete('*/api/v1/account/mfa/totp', () => new HttpResponse(null, { status: 204 })),

  http.post('*/api/v1/account/mfa/webauthn/register/options', () =>
    HttpResponse.json({
      data: {
        challenge: 'Y2hhbGxlbmdlLXRlc3Q', // base64url("challenge-test")
        rp: { name: 'VUNVAULT', id: 'vunvault.test' },
        user: {
          id: 'dXNlci1pZC1tb2Nr', // base64url("user-id-mock")
          name: 'jane@example.com',
          displayName: 'Jane Wanjiru',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: 60000,
        attestation: 'none',
      },
    }),
  ),

  http.post('*/api/v1/account/mfa/webauthn/register/verify', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { deviceName?: string } | null;
    return HttpResponse.json(
      {
        data: {
          id: '30000000-0000-4000-8000-000000000002',
          deviceName: body?.deviceName ?? 'Mock security key',
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
      },
      { status: 201 },
    );
  }),

  http.delete('*/api/v1/account/mfa/webauthn/:id', () => new HttpResponse(null, { status: 204 })),

  http.post('*/api/v1/account/recovery-codes', () =>
    HttpResponse.json(
      {
        data: {
          codes: MOCK_RECOVERY_CODES,
          batchId: '31000000-0000-4000-8000-000000000001',
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    ),
  ),

  http.post('*/api/v1/account/recovery-codes/regenerate', () =>
    HttpResponse.json(
      {
        data: {
          codes: [...MOCK_RECOVERY_CODES].reverse(),
          batchId: '31000000-0000-4000-8000-000000000002',
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    ),
  ),
];
