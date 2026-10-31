import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordBody,
  MfaStatus,
  RecoveryCodesResponse,
  SecurityPosture,
  TotpEnrollStart,
  TotpVerifyBody,
  WebauthnKey,
  WebauthnRegisterVerifyBody,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiDelete, apiGet, apiPost } from '../../../../../lib/api';

/**
 * Security hooks — the account-security surface built in an earlier iteration:
 * the combined status read, the password change, the TOTP enrol/verify/disable
 * trio, WebAuthn registration + removal, and the recovery-code pair.
 *
 * No `'use client'` directive (the directive-free hook-module pattern): only client
 * components import this module.
 */

export type SecurityStatus = MfaStatus & { posture: SecurityPosture };

export const SECURITY_STATUS_KEY = ['account', 'security'] as const;

export function useSecurityStatus() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/account/security → 200 { data: MfaStatus & { posture } }
    queryKey: SECURITY_STATUS_KEY,
    queryFn: () =>
      apiGet<{ data: SecurityStatus }>('/api/v1/account/security').then(
        (response) => response.data,
      ),
  });
}

export function useSecurityInvalidator() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: SECURITY_STATUS_KEY });
    // The header/session chip mirrors MFA state.
    void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
  };
}

export function useChangePassword() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/password body ChangePasswordBody
    //  → 204 | 401 invalid_credentials | 422 breached_password
    mutationFn: (body: ChangePasswordBody) => apiPost<void>('/api/v1/account/password', body),
  });
}

export function useTotpEnroll() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/totp/enroll → 201 TotpEnrollStart
    mutationFn: () =>
      apiPost<TotpEnrollStart>('/api/v1/account/mfa/totp/enroll').then((response) => response.data),
  });
}

export function useTotpVerify() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/totp/verify body { factorId; code }
    //  → 204 | 401 mfa_failed
    mutationFn: (body: TotpVerifyBody) => apiPost<void>('/api/v1/account/mfa/totp/verify', body),
  });
}

export function useDisableTotp() {
  return useMutation({
    // TODO(backend-contract): DELETE /api/v1/account/mfa/totp → 204 | 422 last_factor
    mutationFn: () => apiDelete<void>('/api/v1/account/mfa/totp'),
  });
}

export function useWebauthnRegisterOptions() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/webauthn/register/options
    //  → 200 { data: PublicKeyCredentialCreationOptionsJSON }
    mutationFn: () =>
      apiPost<{ data: WebAuthnCreationOptionsJson }>(
        '/api/v1/account/mfa/webauthn/register/options',
      ).then((response) => response.data),
  });
}

export function useWebauthnRegisterVerify() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/webauthn/register/verify body { deviceName?; credential }
    //  → 201 { data: WebauthnKey }
    mutationFn: (body: WebauthnRegisterVerifyBody) =>
      apiPost<{ data: WebauthnKey }>('/api/v1/account/mfa/webauthn/register/verify', body).then(
        (response) => response.data,
      ),
  });
}

export function useRemoveWebauthnKey() {
  return useMutation({
    // TODO(backend-contract): DELETE /api/v1/account/mfa/webauthn/:id → 204
    mutationFn: (id: string) => apiDelete<void>(`/api/v1/account/mfa/webauthn/${id}`),
  });
}

export function useGenerateRecoveryCodes() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/recovery-codes
    //  → 201 RecoveryCodesResponse | 409 already_generated
    mutationFn: () =>
      apiPost<RecoveryCodesResponse>('/api/v1/account/recovery-codes').then(
        (response) => response.data,
      ),
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/recovery-codes/regenerate → 201 RecoveryCodesResponse
    mutationFn: () =>
      apiPost<RecoveryCodesResponse>('/api/v1/account/recovery-codes/regenerate').then(
        (response) => response.data,
      ),
  });
}

/**
 * The JSON (base64url) shape the API sends for WebAuthn registration options
 * — the browser API wants ArrayBuffers, so `_lib/webauthn-register.ts`
 * converts. Mirrors an earlier iteration's request-options interface.
 */
export interface WebAuthnCreationOptionsJson {
  challenge: string;
  rp: { id?: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    requireResidentKey?: boolean;
    residentKey?: string;
    userVerification?: string;
  };
  excludeCredentials?: Array<{ type: 'public-key'; id: string; transports?: string[] }>;
}
