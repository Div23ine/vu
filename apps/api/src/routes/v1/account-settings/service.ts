import { LANGUAGES, TIMEZONES, type ProfileSettings, type UserRole } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import {
  AVATAR_MAX_BYTES,
  AVATAR_PREFIX,
  PRESIGN_PUT_SECONDS,
  avatarExtension,
  isAllowedAvatarType,
} from '../../../lib/object-storage';
import type { AccountSettingsRepo, SettingsRow } from './repo';
import { SqlAccountSettingsRepo } from './repo';

/**
 * Account settings and avatar uploads.
 *
 * The audit label for this user stays the email local-part, so `display_name` is
 * cosmetic: changing it here does not rewrite anything in the audit log.
 */

export interface AvatarUploadRequest {
  contentType: string;
  sizeBytes: number;
}

export interface AvatarUploadResult {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface SettingsUpdateInput {
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle?: string | null;
  phone?: string | null;
  timezone: string;
  language: string;
  bio?: string | null;
}

export interface SettingsUpdateResult {
  settings: ProfileSettings;
  /** Field names only — never values — for the `PROFILE_UPDATED` audit entry. */
  changedFields: string[];
}

export interface AccountSettingsServiceDeps {
  repo?: AccountSettingsRepo;
  db?: unknown;
  storage: ObjectStorage;
  randomUuid?: () => string;
  now?: () => Date;
}

const SETTINGS_FIELDS: Array<keyof SettingsUpdateInput> = [
  'firstName',
  'lastName',
  'displayName',
  'jobTitle',
  'phone',
  'timezone',
  'language',
  'bio',
];

export class AccountSettingsService {
  private readonly repo: AccountSettingsRepo | undefined;
  private readonly storage: ObjectStorage;
  private readonly randomUuid: () => string;
  private readonly now: () => Date;

  constructor(deps: AccountSettingsServiceDeps) {
    this.repo =
      deps.repo ?? (deps.db === undefined ? undefined : new SqlAccountSettingsRepo(deps.db));
    this.storage = deps.storage;
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  private requireRepo(): AccountSettingsRepo {
    if (this.repo === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Settings are not available');
    }
    return this.repo;
  }

  /** `username` is the local-part of the email; it is derived, never stored. */
  static usernameFor(email: string): string {
    const [localPart] = email.split('@');
    return localPart ?? email;
  }

  async get(userId: string): Promise<ProfileSettings> {
    const repo = this.requireRepo();
    const row = await repo.getSettings(userId);
    const [activeSessions, webauthnKeys] = await Promise.all([
      repo.countActiveSessions(userId),
      repo.countWebauthnCredentials(userId),
    ]);
    return this.toSettings(row, { activeSessions, webauthnKeys });
  }

  private toSettings(
    row: SettingsRow,
    extra: { activeSessions: number; webauthnKeys: number },
  ): ProfileSettings {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      jobTitle: row.jobTitle,
      email: row.email,
      phone: row.phone,
      timezone: row.timezone as ProfileSettings['timezone'],
      language: row.language as ProfileSettings['language'],
      bio: row.bio,
      avatarUrl: row.avatarKey === null ? null : this.storage.publicUrl(row.avatarKey),
      role: row.role as UserRole,
      team: row.team as ProfileSettings['team'],
      memberSince: row.memberSince,
      username: AccountSettingsService.usernameFor(row.email),
      mfaSummary: mfaSummary({
        webauthnKeys: extra.webauthnKeys,
        mfaMethods: row.mfaMethods,
        mfaEnrolled: row.mfaEnrolled,
      }),
      lastSignInAt: row.lastSignInAt,
      activeSessions: extra.activeSessions,
      require2fa: row.require2fa,
    };
  }

  async update(userId: string, input: SettingsUpdateInput): Promise<SettingsUpdateResult> {
    const repo = this.requireRepo();

    if (!(input.timezone in TIMEZONES)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['timezone'], message: 'Select a supported timezone' },
      ]);
    }
    if (!(input.language in LANGUAGES)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['language'], message: 'Select a supported language' },
      ]);
    }

    const before = await repo.getSettings(userId);
    const changedFields: string[] = [];
    for (const field of SETTINGS_FIELDS) {
      const next = input[field];
      if (next === undefined) continue;
      if ((before[field as keyof SettingsRow] as unknown) !== next) changedFields.push(field);
    }

    // `full_name` is derived from the two halves and kept in sync; `display_name`
    // is what a colleague sees and may differ.
    const fullName = `${input.firstName} ${input.lastName}`.trim();
    await repo.updateSettings(userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      fullName,
      displayName: input.displayName,
      jobTitle: input.jobTitle ?? before.jobTitle,
      phone: input.phone ?? before.phone,
      timezone: input.timezone,
      language: input.language,
      bio: input.bio ?? before.bio,
    });

    const after = await repo.getSettings(userId);
    const [activeSessions, webauthnKeys] = await Promise.all([
      repo.countActiveSessions(userId),
      repo.countWebauthnCredentials(userId),
    ]);
    return {
      settings: this.toSettings({ ...after, fullName } as SettingsRow, {
        activeSessions,
        webauthnKeys,
      }),
      changedFields,
    };
  }

  /**
   * Issues a presigned PUT so the browser can upload straight to R2. Nothing
   * larger than the declared maximum is ever accepted at confirm time.
   */
  async createAvatarUpload(
    userId: string,
    request: AvatarUploadRequest,
  ): Promise<AvatarUploadResult> {
    if (!isAllowedAvatarType(request.contentType)) {
      throw new HttpError(422, 'unsupported_type', 'That file type is not accepted');
    }
    if (request.sizeBytes > AVATAR_MAX_BYTES) {
      throw new HttpError(422, 'file_too_large', 'Avatars must be 4 MB or smaller');
    }
    const extension = avatarExtension(request.contentType) ?? 'bin';
    const objectKey = `${AVATAR_PREFIX}${userId}/${this.randomUuid()}.${extension}`;
    const { url } = await this.storage.presignPut({
      key: objectKey,
      contentType: request.contentType,
      maxBytes: AVATAR_MAX_BYTES,
      expiresSec: PRESIGN_PUT_SECONDS,
    });
    return {
      uploadUrl: url,
      objectKey,
      expiresAt: new Date(this.now().getTime() + PRESIGN_PUT_SECONDS * 1000).toISOString(),
    };
  }

  async confirmAvatar(userId: string, objectKey: string): Promise<ProfileSettings> {
    const repo = this.requireRepo();
    const ownPrefix = `${AVATAR_PREFIX}${userId}/`;
    if (!objectKey.startsWith(ownPrefix)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['objectKey'], message: 'That object key does not belong to you' },
      ]);
    }

    const metadata = await this.storage.head(objectKey);
    if (metadata === null) throw new HttpError(404, 'not_found', 'That upload has not arrived yet');
    if (metadata.size > AVATAR_MAX_BYTES) {
      throw new HttpError(422, 'file_too_large', 'Avatars must be 4 MB or smaller');
    }
    if (!isAllowedAvatarType(metadata.contentType)) {
      throw new HttpError(422, 'unsupported_type', 'That file type is not accepted');
    }

    // TODO(worker): the maintenance worker malware-scans the object and strips
    // EXIF asynchronously (Task 30's `avatar_scan` queue). This route only
    // validates the object and records the key.
    const previous = await repo.getSettings(userId);
    await repo.setAvatarKey(userId, objectKey);
    if (previous.avatarKey !== null && previous.avatarKey !== objectKey) {
      await this.storage.delete(previous.avatarKey).catch(() => undefined);
    }

    const after = await repo.getSettings(userId);
    const [activeSessions, webauthnKeys] = await Promise.all([
      repo.countActiveSessions(userId),
      repo.countWebauthnCredentials(userId),
    ]);
    return this.toSettings({ ...after, avatarKey: objectKey }, { activeSessions, webauthnKeys });
  }

  async deleteAvatar(userId: string): Promise<void> {
    const repo = this.requireRepo();
    const row = await repo.getSettings(userId);
    await repo.setAvatarKey(userId, null);
    if (row.avatarKey !== null) {
      await this.storage.delete(row.avatarKey).catch(() => undefined);
    }
  }
}

function mfaSummary(input: {
  webauthnKeys: number;
  mfaMethods: string[];
  mfaEnrolled: boolean;
}): string {
  if (input.webauthnKeys > 0 || input.mfaMethods.includes('webauthn')) return 'Hardware key';
  if (input.mfaMethods.includes('totp')) return 'Authenticator app';
  return 'Not enabled';
}
