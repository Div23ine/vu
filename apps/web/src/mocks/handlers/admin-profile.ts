import { http, HttpResponse } from 'msw';
import type {
  NotificationPrefs,
  ProfileSettings,
  SessionView,
  UpdateProfileSettingsBody,
} from '@vunvault/contracts';
// Imported as a value: the notifications PUT is validated with the contract's
// own schema, so the quiet-hours `HH:MM` rule cannot drift between mock and API.
import { NotificationPrefs as NotificationPrefsSchema } from '@vunvault/contracts';
import {
  notificationPrefs,
  profileSettings,
  sessions as sessionFixture,
} from '@vunvault/contracts/fixtures/account';

/**
 * Admin account-settings mock handlers (Task 83c).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * The Task 20d fixture IS the profile (Dr. Evelyn Reed), and the writes mutate a
 * module-level copy so a save is visible on the next read; tests reset it with
 * `resetAdminProfile()`.
 *
 * The avatar chain is modelled end to end, because the ORDER of the three
 * requests is part of what Task 83c must prove: the upload-url call mints a
 * presigned PUT on a separate storage origin (intercepted here so no test ever
 * reaches the network), the PUT stores the bytes, and the confirm call is what
 * actually sets `avatarUrl`. A confirm without a preceding PUT would be a bug
 * the mock cannot detect, so `confirm` refuses an unknown object key.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 30):
 *   GET    /api/v1/account/settings              → 200 { data: ProfileSettings }
 *   PATCH  /api/v1/account/settings              → 200 { data: ProfileSettings } | 422
 *   POST   /api/v1/account/avatar/upload-url     → 200 { data: { uploadUrl; objectKey; expiresAt } }
 *   PUT    <presigned uploadUrl>                 → 200
 *   POST   /api/v1/account/avatar/confirm        → 200 { data: ProfileSettings } | 404
 *   DELETE /api/v1/account/avatar                → 204
 *
 * Task 83d adds the account surfaces the client Password Manager does NOT
 * already mock (`mocks/handlers/security.ts` owns `/account/security`, the
 * password change and the MFA routes, and is deliberately not duplicated here):
 *   GET    /api/v1/account/sessions              → 200 { data: SessionView[] }
 *   DELETE /api/v1/account/sessions/:id          → 204 | 409 current_session
 *   POST   /api/v1/account/revoke-others         → 200 { data: { revoked } }
 *   POST   /api/v1/account/deactivation-request  → 202 | 409 already_requested | 422
 *   GET    /api/v1/account/notifications         → 200 { data: NotificationPrefs }
 *   PUT    /api/v1/account/notifications         → 200 { data: NotificationPrefs } | 422
 */

/** The storage origin the presigned URLs point at. */
const STORAGE_ORIGIN = 'https://storage.vunvault.test';

let profile: ProfileSettings = { ...profileSettings };
let sessionList: SessionView[] = sessionFixture.map((session) => ({ ...session }));
let prefs: NotificationPrefs = structuredClone(notificationPrefs);
let deactivationPending = false;
/** Object keys the mock has handed out AND received bytes for. */
let staged = new Set<string>();
let issued = new Set<string>();
let keySeq = 0;

/** Restore the fixture profile (tests call this in `beforeEach`). */
export function resetAdminProfile(): void {
  profile = { ...profileSettings };
  staged = new Set();
  issued = new Set();
  keySeq = 0;
  sessionList = sessionFixture.map((session) => ({ ...session }));
  prefs = structuredClone(notificationPrefs);
  deactivationPending = false;
}

export const adminProfileHandlers = [
  http.get('*/api/v1/account/settings', () => HttpResponse.json({ data: profile })),

  http.patch('*/api/v1/account/settings', async ({ request }) => {
    const body = (await request.json()) as UpdateProfileSettingsBody;
    // `email` is owned by Supabase Auth and is never in the body; a caller that
    // sends one is trying to change what it cannot.
    profile = {
      ...profile,
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: body.displayName,
      jobTitle: body.jobTitle ?? null,
      phone: body.phone ?? null,
      timezone: body.timezone,
      language: body.language,
      bio: body.bio ?? null,
    };
    return HttpResponse.json({ data: profile });
  }),

  http.post('*/api/v1/account/avatar/upload-url', async ({ request }) => {
    const body = (await request.json()) as { contentType: string; sizeBytes: number };
    const extension =
      body.contentType === 'image/png'
        ? 'png'
        : body.contentType === 'image/jpeg'
          ? 'jpg'
          : body.contentType === 'image/webp'
            ? 'webp'
            : 'svg';
    keySeq += 1;
    const objectKey = `avatars/${profile.id}/${keySeq}.${extension}`;
    issued = new Set([...issued, objectKey]);
    return HttpResponse.json({
      data: {
        uploadUrl: `${STORAGE_ORIGIN}/${objectKey}?sig=test-signature`,
        objectKey,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    });
  }),

  // The presigned PUT — a different origin, so it needs its own interceptor.
  // The object key is the URL path, which is what `confirm` later checks.
  http.put(`${STORAGE_ORIGIN}/*`, ({ request }) => {
    const key = new URL(request.url).pathname.replace(/^\//, '');
    if (issued.has(key)) staged = new Set([...staged, key]);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post('*/api/v1/account/avatar/confirm', async ({ request }) => {
    const { objectKey } = (await request.json()) as { objectKey: string };
    if (!issued.has(objectKey)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    // The bytes must have reached storage before the avatar can be confirmed.
    if (!staged.has(objectKey)) {
      return HttpResponse.json({ error: 'upload_not_received' }, { status: 409 });
    }
    profile = { ...profile, avatarUrl: `${STORAGE_ORIGIN}/${objectKey}` };
    return HttpResponse.json({ data: profile });
  }),

  http.delete('*/api/v1/account/avatar', () => {
    profile = { ...profile, avatarUrl: null };
    staged = new Set();
    return new HttpResponse(null, { status: 204 });
  }),

  // ——— Task 83d: sessions, deactivation, notifications ———
  http.get('*/api/v1/account/sessions', () => HttpResponse.json({ data: sessionList })),

  http.delete('*/api/v1/account/sessions/:id', ({ params }) => {
    const id = String(params.id);
    const target = sessionList.find((session) => session.id === id);
    if (target === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    // The session you are typing from cannot revoke itself.
    if (target.current) {
      return HttpResponse.json({ error: 'current_session' }, { status: 409 });
    }
    sessionList = sessionList.filter((session) => session.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/account/revoke-others', () => {
    const revoked = sessionList.filter((session) => !session.current).length;
    sessionList = sessionList.filter((session) => session.current);
    return HttpResponse.json({ data: { revoked } });
  }),

  http.post('*/api/v1/account/deactivation-request', async ({ request }) => {
    const { reason } = (await request.json()) as { reason: string };
    if (reason.trim().length < 10) {
      return HttpResponse.json({ error: 'validation_failed' }, { status: 422 });
    }
    if (deactivationPending) {
      return HttpResponse.json({ error: 'already_requested' }, { status: 409 });
    }
    deactivationPending = true;
    return new HttpResponse(null, { status: 202 });
  }),

  http.get('*/api/v1/account/notifications', () => HttpResponse.json({ data: prefs })),

  http.put('*/api/v1/account/notifications', async ({ request }) => {
    const body = (await request.json()) as NotificationPrefs;
    const parsed = NotificationPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 422 },
      );
    }
    prefs = parsed.data;
    return HttpResponse.json({ data: prefs });
  }),
];

/** Test helper: the object keys that actually received bytes. */
export function stagedAvatarKeys(): string[] {
  return [...staged];
}
