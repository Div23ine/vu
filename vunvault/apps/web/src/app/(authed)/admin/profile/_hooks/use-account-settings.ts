import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileSettings, UpdateProfileSettingsBody } from '@vunvault/contracts';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../../../lib/api';

/**
 * Account-settings hooks (Task 83c) — the administrator's own profile: the
 * settings read model, the personal-details write and the three-step avatar
 * upload.
 *
 * `queryKeys` (packages/lib) has only a client-facing `profile()` entry, and
 * this task must not touch packages/lib, so the admin keys live here — the
 * Task 67 `SECURITY_STATUS_KEY` precedent. They are deliberately distinct from
 * the portal's `profile()` key: the client profile is a different read model
 * (`ClientProfile`) on a different route.
 *
 * The avatar upload is a three-request chain the browser drives:
 *   1. `POST /account/avatar/upload-url` — the API validates type + size and
 *      mints a short-lived presigned PUT.
 *   2. `PUT <uploadUrl>` — the bytes go straight to storage, never through the
 *      API (and never through this app's session cookie).
 *   3. `POST /account/avatar/confirm { objectKey }` — the API records the
 *      object and queues it for malware scanning.
 * Step 2 is a raw `fetch`: a presigned URL is absolute, carries no CSRF token
 * and must not be rewritten by the API transport.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const ACCOUNT_SETTINGS_KEY = ['account-settings'] as const;

export function useProfileSettings() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/account/settings → 200 { data: ProfileSettings }
    queryKey: ACCOUNT_SETTINGS_KEY,
    queryFn: () =>
      apiGet<{ data: ProfileSettings }>('/api/v1/account/settings').then(
        (response) => response.data,
      ),
  });
}

export function useUpdateProfileSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PATCH /api/v1/account/settings body UpdateProfileSettingsBody
    //   → 200 { data: ProfileSettings } | 422 validation_failed
    mutationFn: (body: UpdateProfileSettingsBody) =>
      apiPatch<{ data: ProfileSettings }>('/api/v1/account/settings', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_SETTINGS_KEY });
    },
  });
}

export interface AvatarUploadUrl {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export function useRequestAvatarUploadUrl() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/avatar/upload-url
    //   body { contentType; sizeBytes } → 200 { data: { uploadUrl; objectKey; expiresAt } }
    //   | 413 too_large | 415 unsupported_type
    mutationFn: (body: { contentType: string; sizeBytes: number }) =>
      apiPost<{ data: AvatarUploadUrl }>('/api/v1/account/avatar/upload-url', body).then(
        (response) => response.data,
      ),
  });
}

/**
 * Step 2 of the avatar chain — a raw PUT to the presigned URL.
 *
 * Deliberately NOT the API transport: the URL is absolute and pre-authorised,
 * so it must carry no session cookie and no CSRF header. Returns false on any
 * non-2xx so the caller can report a single `Upload failed`.
 */
export async function putAvatarToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<boolean> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type },
  });
  return response.ok;
}

export function useConfirmAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/avatar/confirm body { objectKey }
    //   → 200 { data: ProfileSettings }
    mutationFn: (objectKey: string) =>
      apiPost<{ data: ProfileSettings }>('/api/v1/account/avatar/confirm', { objectKey }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_SETTINGS_KEY });
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): DELETE /api/v1/account/avatar → 204
    mutationFn: () => apiDelete<void>('/api/v1/account/avatar'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_SETTINGS_KEY });
    },
  });
}

/** `Evelyn Reed → "ER"` — the initials fallback the header and uploader show. */
export function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  return `${first}${last}`;
}
