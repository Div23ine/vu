import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, TIMEZONES } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import type { ObjectStorage, ObjectMetadata } from '../../../lib/object-storage.js';
import { AccountSettingsService } from './service.js';
import type { AccountSettingsRepo, SettingsPatch, SettingsRow } from './repo.js';

const USER_ID = 'd0000000-0000-4000-8000-000000000001';
const OTHER_ID = 'd0000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-09-24T12:00:00.000Z');

class FakeSettingsRepo implements AccountSettingsRepo {
  row: SettingsRow = {
    id: USER_ID,
    firstName: 'Evelyn',
    lastName: 'Reed',
    fullName: 'Evelyn Reed',
    displayName: 'Dr. Evelyn Reed',
    jobTitle: 'Head of Threat Intelligence',
    email: 'e.reed@vunvault.com',
    phone: '+254712345678',
    timezone: 'Africa/Nairobi',
    language: 'en-GB',
    bio: null,
    avatarKey: 'avatars/' + USER_ID + '/old.png',
    role: 'super_admin',
    team: 'intelligence',
    memberSince: '2024-03-01T09:00:00.000Z',
    require2fa: true,
    mfaEnrolled: true,
    mfaMethods: ['totp'],
    lastSignInAt: '2026-09-24T08:15:00.000Z',
  };
  sessions = 3;
  webauthnKeys = 0;
  patches: SettingsPatch[] = [];
  avatarWrites: Array<string | null> = [];

  async getSettings() {
    return { ...this.row };
  }
  async updateSettings(_userId: string, patch: SettingsPatch) {
    this.patches.push(patch);
    this.row = { ...this.row, ...patch } as SettingsRow;
  }
  async setAvatarKey(_userId: string, avatarKey: string | null) {
    this.avatarWrites.push(avatarKey);
    this.row = { ...this.row, avatarKey };
  }
  async countActiveSessions() {
    return this.sessions;
  }
  async countWebauthnCredentials() {
    return this.webauthnKeys;
  }
}

class FakeStorage implements ObjectStorage {
  objects = new Map<string, ObjectMetadata>();
  deleted: string[] = [];
  presigned: Array<{ key: string; contentType: string; maxBytes: number; expiresSec: number }> = [];

  async presignPut(input: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresSec: number;
  }) {
    this.presigned.push(input);
    return {
      url: `https://r2.test/${input.key}?sig=abc`,
      headers: { 'content-type': input.contentType },
    };
  }
  async head(key: string) {
    return this.objects.get(key) ?? null;
  }
  async delete(key: string) {
    this.deleted.push(key);
    this.objects.delete(key);
  }
  async presignGet(input: { key: string }) {
    return `https://r2.test/${input.key}?sig=read`;
  }
  publicUrl(key: string) {
    return `https://cdn.vunvault.test/${key}`;
  }
}

function makeService() {
  const repo = new FakeSettingsRepo();
  const storage = new FakeStorage();
  let sequence = 0;
  const service = new AccountSettingsService({
    repo,
    storage,
    randomUuid: () => `00000000-0000-4000-8000-00000000000${(sequence += 1)}`,
    now: () => NOW,
  });
  return { service, repo, storage };
}

const VALID_BODY = {
  firstName: 'Evelyn',
  lastName: 'Reed',
  displayName: 'Dr. Evelyn Reed',
  timezone: 'Africa/Nairobi',
  language: 'en-GB',
};

describe('GET settings', () => {
  it('derives the username from the email local-part and summarises MFA', async () => {
    const { service } = makeService();
    const settings = await service.get(USER_ID);
    expect(settings.username).toBe('e.reed');
    expect(settings.mfaSummary).toBe('Authenticator app');
    expect(settings.avatarUrl).toBe(`https://cdn.vunvault.test/avatars/${USER_ID}/old.png`);
    expect(settings.activeSessions).toBe(3);
    expect(settings.memberSince).toBe('2024-03-01T09:00:00.000Z');

    // A hardware key outranks the authenticator app in the summary.
    const { service: keyed, repo } = makeService();
    repo.webauthnKeys = 1;
    expect((await keyed.get(USER_ID)).mfaSummary).toBe('Hardware key');

    const { service: none, repo: bare } = makeService();
    bare.row.mfaMethods = [];
    bare.row.mfaEnrolled = false;
    expect((await none.get(USER_ID)).mfaSummary).toBe('Not enabled');
  });
});

describe('PATCH settings', () => {
  it('rejects an unknown timezone and an unknown language', async () => {
    const { service, repo } = makeService();
    const badTimezone = await service
      .update(USER_ID, { ...VALID_BODY, timezone: 'Mars/Olympus' })
      .catch((caught: unknown) => caught);
    expect(badTimezone).toBeInstanceOf(HttpError);
    expect((badTimezone as HttpError).status).toBe(400);
    expect((badTimezone as HttpError).code).toBe('validation_failed');
    expect((badTimezone as HttpError).details).toEqual([
      { path: ['timezone'], message: 'Select a supported timezone' },
    ]);
    expect(repo.patches).toHaveLength(0);
    expect(Object.keys(TIMEZONES)).toContain('Africa/Nairobi');

    const badLanguage = await service
      .update(USER_ID, { ...VALID_BODY, language: 'kl' })
      .catch((caught: unknown) => caught);
    expect((badLanguage as HttpError).code).toBe('validation_failed');
    expect(repo.patches).toHaveLength(0);
  });

  it('keeps full_name in sync with firstName + lastName', async () => {
    const { service, repo } = makeService();
    const result = await service.update(USER_ID, { ...VALID_BODY, firstName: 'Eve' });
    expect(repo.patches[0]?.fullName).toBe('Eve Reed');
    expect(result.settings.firstName).toBe('Eve');
    expect(result.changedFields).toEqual(['firstName']);
  });

  it('reports changed field names without ever reporting values', async () => {
    const { service } = makeService();
    const result = await service.update(USER_ID, {
      ...VALID_BODY,
      phone: '+254700000000',
      bio: 'Threat intelligence lead.',
    });
    expect(result.changedFields).toEqual(['phone', 'bio']);

    // The route forwards `changedFields` verbatim as `details.fields`.
    const details = JSON.stringify({ fields: result.changedFields });
    expect(details).toContain('phone');
    expect(details).not.toContain('+254700000000');
    expect(details).not.toContain('700000000');
  });

  it('reports no changed fields when nothing differs', async () => {
    const { service, repo } = makeService();
    const result = await service.update(USER_ID, VALID_BODY);
    expect(result.changedFields).toEqual([]);
    expect(repo.patches).toHaveLength(1);
  });
});

describe('avatar upload-url', () => {
  it('issues a 300-second presigned PUT under the user’s own prefix', async () => {
    const { service, storage } = makeService();
    const result = await service.createAvatarUpload(USER_ID, {
      contentType: 'image/png',
      sizeBytes: 102_400,
    });
    expect(result.objectKey).toBe(`avatars/${USER_ID}/00000000-0000-4000-8000-000000000001.png`);
    expect(result.uploadUrl).toContain(result.objectKey);
    expect(result.expiresAt).toBe(new Date(NOW.getTime() + 300_000).toISOString());
    expect(storage.presigned[0]).toMatchObject({
      contentType: 'image/png',
      maxBytes: AVATAR_MAX_BYTES,
      expiresSec: 300,
    });
  });

  it('rejects a declared 5 MB upload before any URL is issued', async () => {
    const { service, storage } = makeService();
    const error = await service
      .createAvatarUpload(USER_ID, { contentType: 'image/png', sizeBytes: 5 * 1024 * 1024 })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(422);
    expect((error as HttpError).code).toBe('file_too_large');
    expect(storage.presigned).toHaveLength(0);

    // Exactly at the limit is fine.
    const ok = await service.createAvatarUpload(USER_ID, {
      contentType: 'image/png',
      sizeBytes: AVATAR_MAX_BYTES,
    });
    expect(ok.objectKey).toContain('avatars/');
  });

  it('allows SVG but refuses a PDF', async () => {
    const { service } = makeService();
    const svg = await service.createAvatarUpload(USER_ID, {
      contentType: 'image/svg+xml',
      sizeBytes: 2048,
    });
    expect(svg.objectKey).toMatch(/\.svg$/);

    const pdf = await service
      .createAvatarUpload(USER_ID, { contentType: 'application/pdf', sizeBytes: 2048 })
      .catch((caught: unknown) => caught);
    expect((pdf as HttpError).status).toBe(422);
    expect((pdf as HttpError).code).toBe('unsupported_type');
  });
});

describe('avatar confirm', () => {
  it('refuses another user’s key prefix', async () => {
    const { service, repo, storage } = makeService();
    storage.objects.set(`avatars/${OTHER_ID}/x.png`, { size: 10, contentType: 'image/png' });
    const error = await service
      .confirmAvatar(USER_ID, `avatars/${OTHER_ID}/x.png`)
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).code).toBe('validation_failed');
    expect(repo.avatarWrites).toHaveLength(0);
    expect(storage.deleted).toHaveLength(0);
  });

  it('records the key, replaces the old object and returns the public URL', async () => {
    const { service, repo, storage } = makeService();
    const key = `avatars/${USER_ID}/new.webp`;
    storage.objects.set(key, { size: 20_000, contentType: 'image/webp' });

    const settings = await service.confirmAvatar(USER_ID, key);
    expect(settings.avatarUrl).toBe(`https://cdn.vunvault.test/${key}`);
    expect(repo.avatarWrites).toEqual([key]);
    expect(storage.deleted).toEqual([`avatars/${USER_ID}/old.png`]);
  });

  it('refuses a missing object, an oversized one and a disallowed type', async () => {
    const { service, storage, repo } = makeService();
    const missing = await service
      .confirmAvatar(USER_ID, `avatars/${USER_ID}/nope.png`)
      .catch((caught: unknown) => caught);
    expect((missing as HttpError).status).toBe(404);
    expect((missing as HttpError).code).toBe('not_found');

    storage.objects.set(`avatars/${USER_ID}/big.png`, {
      size: AVATAR_MAX_BYTES + 1,
      contentType: 'image/png',
    });
    const tooBig = await service
      .confirmAvatar(USER_ID, `avatars/${USER_ID}/big.png`)
      .catch((caught: unknown) => caught);
    expect((tooBig as HttpError).code).toBe('file_too_large');

    // A PNG extension hiding a PDF is caught by the stored content type.
    storage.objects.set(`avatars/${USER_ID}/lie.png`, {
      size: 100,
      contentType: 'application/pdf',
    });
    const wrongType = await service
      .confirmAvatar(USER_ID, `avatars/${USER_ID}/lie.png`)
      .catch((caught: unknown) => caught);
    expect((wrongType as HttpError).code).toBe('unsupported_type');
    expect(repo.avatarWrites).toHaveLength(0);
  });
});

describe('avatar delete', () => {
  it('nulls the key and removes the object', async () => {
    const { service, repo, storage } = makeService();
    await service.deleteAvatar(USER_ID);
    expect(repo.avatarWrites).toEqual([null]);
    expect(storage.deleted).toEqual([`avatars/${USER_ID}/old.png`]);
    expect((await service.get(USER_ID)).avatarUrl).toBeNull();
  });

  it('is a no-op when there is nothing to remove', async () => {
    const { service, repo, storage } = makeService();
    repo.row.avatarKey = null;
    await service.deleteAvatar(USER_ID);
    expect(storage.deleted).toHaveLength(0);
  });
});
