import { is } from 'drizzle-orm';
import { getTableConfig, PgTable, type AnyPgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './index';
import {
  loginAttempts,
  notificationPreferences,
  notificationReceipts,
  notificationSettings,
  notifications,
  onboardingProfiles,
  userRecoveryCodes,
  userSessions,
  SUPPORTED_LANGUAGES,
} from './account';
import { contentItems } from './content';
import { profiles } from './identity';
import {
  BLOG_CATEGORIES,
  CAREER_ROLES,
  ENTITY_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  RECOVERY_QUESTIONS,
} from '../enum-values';

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function columnOf(table: Parameters<typeof getTableConfig>[0], name: string) {
  const found = getTableConfig(table).columns.find((column) => column.name === name);
  if (found === undefined) throw new Error(`column ${name} is missing`);
  return found;
}

function checkNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).checks.map((constraint) => constraint.name);
}

/** Every table in the schema, keyed by SQL name. */
function allTables(): Array<[string, AnyPgTable]> {
  const tables: Array<[string, AnyPgTable]> = [];
  for (const value of Object.values(schema) as unknown[]) {
    if (!is(value, PgTable)) continue;
    const table = value as AnyPgTable;
    tables.push([getTableConfig(table).name, table]);
  }
  return tables.sort((a, b) => a[0].localeCompare(b[0]));
}

const TABLES = [
  ['user_recovery_codes', userRecoveryCodes],
  ['user_sessions', userSessions],
  ['notification_preferences', notificationPreferences],
  ['notification_settings', notificationSettings],
  ['onboarding_profiles', onboardingProfiles],
  ['login_attempts', loginAttempts],
  ['notifications', notifications],
  ['notification_receipts', notificationReceipts],
] as const;

describe('account tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});

describe('plaintext-secret guard', () => {
  it('stores no bare secret column in the account tables', () => {
    const bareSecretNames = new Set(['code', 'answer', 'password', 'secret', 'token']);
    for (const [name, table] of TABLES) {
      for (const column of columnNames(table)) {
        expect(bareSecretNames.has(column), `${name}.${column}`).toBe(false);
      }
    }
  });

  it('hashes or encrypts every secret-shaped column in the whole schema', () => {
    // Passwords and TOTP secrets belong to Supabase Auth: the only column allowed
    // to mention one is a *timestamp* recording when it changed, never a value.
    const credentialStem = /(password|secret|totp)/;
    // Anything answer/token shaped must be a digest or sealed ciphertext.
    const mustBeSealed = /(answer|token)/;
    const sealedSuffix = /(_hash|_enc)$/;

    for (const [tableName, table] of allTables()) {
      for (const column of columnNames(table)) {
        const qualified = `${tableName}.${column}`;
        if (credentialStem.test(column)) {
          expect(
            columnOf(table, column).getSQLType(),
            `${qualified} may only record when a credential changed`,
          ).toContain('timestamp');
        }
        if (mustBeSealed.test(column)) {
          expect(sealedSuffix.test(column), `${qualified} must be hashed or sealed`).toBe(true);
        }
      }
    }

    // The one credential-mentioning column in the schema is that timestamp.
    expect(columnOf(profiles, 'last_password_change_at').getSQLType()).toContain('timestamp');

    // The two secret-bearing columns this task adds are digests by name.
    expect(columnOf(userRecoveryCodes, 'code_hash').notNull).toBe(true);
    expect(columnNames(onboardingProfiles)).toContain('recovery_answer_hash');
    expect(columnNames(loginAttempts)).toContain('email_hash');
    expect(columnNames(loginAttempts)).not.toContain('email');
  });
});

describe('user_recovery_codes', () => {
  it('scopes a code to a user and a batch', () => {
    expect(columnNames(userRecoveryCodes)).toEqual([
      'id',
      'user_id',
      'batch_id',
      'code_hash',
      'used_at',
      'created_at',
    ]);
    const config = getTableConfig(userRecoveryCodes);
    expect(config.indexes.map((idx) => idx.config.name)).toEqual([
      'user_recovery_codes_user_batch_idx',
      'user_recovery_codes_user_code_idx',
    ]);
    const unique = config.indexes.find(
      (idx) => idx.config.name === 'user_recovery_codes_user_code_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(2);
    // Revoking a batch, and a used code, are both representable.
    expect(columnOf(userRecoveryCodes, 'used_at').notNull).toBe(false);
  });
});

describe('user_sessions', () => {
  it('uses the Supabase Auth session id as its primary key', () => {
    expect(columnNames(userSessions)).toEqual([
      'id',
      'user_id',
      'device_label',
      'user_agent',
      'ip',
      'geo_city',
      'geo_country',
      'mfa_method',
      'started_at',
      'last_seen_at',
      'revoked_at',
    ]);
    const id = columnOf(userSessions, 'id');
    expect(id.primary).toBe(true);
    // No server default: the id comes from Supabase Auth.
    expect(id.hasDefault).toBe(false);
    expect(columnOf(userSessions, 'ip').getSQLType()).toBe('inet');
    expect(getTableConfig(userSessions).indexes.map((idx) => idx.config.name)).toEqual([
      'user_sessions_user_revoked_idx',
    ]);
  });
});

describe('notification_preferences', () => {
  it('keys one row per user and event', () => {
    expect(columnNames(notificationPreferences)).toEqual([
      'user_id',
      'event',
      'in_app',
      'email',
      'sms',
      'push',
    ]);
    const keys = getTableConfig(notificationPreferences).primaryKeys;
    expect(keys).toHaveLength(1);
    expect(keys[0]?.columns.map((column) => column.name)).toEqual(['user_id', 'event']);
    // The four channels from the enum, and nothing else.
    expect(NOTIFICATION_CHANNELS).toEqual(['in_app', 'email', 'sms', 'push']);
    for (const channel of NOTIFICATION_CHANNELS) {
      expect(columnOf(notificationPreferences, channel).notNull).toBe(true);
    }
  });
});

describe('notification_settings', () => {
  it('is one row per user with a quiet-hours window', () => {
    expect(columnNames(notificationSettings)).toEqual([
      'user_id',
      'quiet_hours_enabled',
      'quiet_from',
      'quiet_to',
    ]);
    expect(columnOf(notificationSettings, 'user_id').primary).toBe(true);
    expect(columnOf(notificationSettings, 'quiet_from').getSQLType()).toBe('time');
    expect(String(columnOf(notificationSettings, 'quiet_hours_enabled').default)).toContain(
      'false',
    );
  });
});

describe('onboarding_profiles', () => {
  it('stores the wizard answers and hashes the recovery answer', () => {
    expect(columnNames(onboardingProfiles)).toEqual([
      'user_id',
      'date_of_birth',
      'career',
      'entity',
      'recovery_question',
      'recovery_answer_hash',
      'declarations',
      'terms_version',
      'completed_at',
      'created_at',
      'updated_at',
    ]);
    expect(columnOf(onboardingProfiles, 'user_id').primary).toBe(true);
    expect(columnOf(onboardingProfiles, 'declarations').default).toEqual({
      infoAccurate: false,
      authorisedTesting: false,
      termsAccepted: false,
    });
    expect(checkNames(onboardingProfiles)).toContain('onboarding_profiles_min_age');
  });
});

describe('login_attempts', () => {
  it('indexes both lockout lookups and never stores the address', () => {
    expect(columnNames(loginAttempts)).toEqual([
      'id',
      'email_hash',
      'ip',
      'succeeded',
      'reason',
      'created_at',
    ]);
    expect(getTableConfig(loginAttempts).indexes.map((idx) => idx.config.name)).toEqual([
      'login_attempts_email_created_idx',
      'login_attempts_ip_created_idx',
    ]);
    expect(columnOf(loginAttempts, 'ip').notNull).toBe(true);
  });
});

describe('profiles addendum', () => {
  it('adds the Profile Settings and badge columns', () => {
    for (const column of [
      'first_name',
      'last_name',
      'display_name',
      'timezone',
      'language',
      'bio',
      'avatar_key',
      'require_2fa',
      'last_password_change_at',
      'last_factor_change_at',
      'deactivation_requested_at',
      'verified_blogger_at',
      'verified_blogger_by',
    ]) {
      expect(columnNames(profiles), `missing ${column}`).toContain(column);
    }
    expect(String(columnOf(profiles, 'timezone').default)).toContain('Africa/Nairobi');
    expect(String(columnOf(profiles, 'language').default)).toContain('en-GB');
    expect(String(columnOf(profiles, 'require_2fa').default)).toContain('true');
    expect(checkNames(profiles)).toContain('profiles_language_supported');
    expect(checkNames(profiles)).toContain('profiles_bio_length');
    // The badge granter is a self-reference to profiles.
    expect(getTableConfig(profiles).foreignKeys.map((key) => key.getName())).toContain(
      'profiles_verified_blogger_by_profiles_id_fk',
    );
  });

  it('ships exactly four languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en-GB', 'en-US', 'sw', 'fr']);
  });
});

describe('content_items addendum', () => {
  it('adds the Content Studio columns with their limits', () => {
    for (const column of [
      'category',
      'tags',
      'featured_image_key',
      'featured_image_url',
      'image_alt',
      'read_minutes',
      'excerpt',
    ]) {
      expect(columnNames(contentItems), `missing ${column}`).toContain(column);
    }
    // `summary` stays for the non-blog types.
    expect(columnNames(contentItems)).toContain('summary');
    expect(checkNames(contentItems)).toContain('content_items_tags_max');
    expect(checkNames(contentItems)).toContain('content_items_excerpt_length');
    expect(getTableConfig(contentItems).indexes.map((idx) => idx.config.name)).toContain(
      'content_items_category_idx',
    );
    expect(columnOf(contentItems, 'read_minutes').getSQLType()).toBe('smallint');
  });
});

describe('Task 20c enums', () => {
  it('adds the six new value sets', () => {
    expect(CAREER_ROLES).toEqual([
      'student',
      'business_owner',
      'cybersecurity_professional',
      'independent_specialist',
    ]);
    expect(ENTITY_TYPES).toEqual(['individual', 'company', 'corporation']);
    expect(RECOVERY_QUESTIONS).toEqual([
      'first_pet',
      'birth_city',
      'maiden_name',
      'first_car',
      'first_school',
    ]);
    expect(NOTIFICATION_EVENTS).toHaveLength(11);
    expect(NOTIFICATION_EVENTS).toContain('advisory_broadcast');
    expect(NOTIFICATION_EVENTS).toContain('weekly_digest');
    expect(NOTIFICATION_CHANNELS).toEqual(['in_app', 'email', 'sms', 'push']);
    expect(BLOG_CATEGORIES).toEqual([
      'news',
      'threat_intel',
      'blog',
      'industry_updates',
      'tutorials',
    ]);
  });
});

describe('notifications (Task 90 inbox)', () => {
  it('stores the in-app tile and caps its copy', () => {
    expect(columnNames(notifications)).toEqual([
      'id',
      'user_id',
      'event',
      'title',
      'body',
      'read_at',
      'created_at',
    ]);
    expect(columnOf(notifications, 'user_id').notNull).toBe(true);
    expect(columnOf(notifications, 'event').getSQLType()).toContain('notification_event');
    expect(columnOf(notifications, 'read_at').notNull).toBe(false);
    expect(checkNames(notifications)).toEqual([
      'notifications_title_length',
      'notifications_body_length',
    ]);
    expect(getTableConfig(notifications).indexes.map((idx) => idx.config.name)).toEqual([
      'notifications_user_created_idx',
      'notifications_user_unread_idx',
    ]);
  });
});

describe('notification_receipts (Task 90)', () => {
  it('records one row per attempt with a constrained status', () => {
    expect(columnNames(notificationReceipts)).toEqual([
      'id',
      'channel',
      'destination',
      'template',
      'status',
      'provider_message_id',
      'error',
      'created_at',
    ]);
    expect(columnOf(notificationReceipts, 'channel').getSQLType()).toContain(
      'notification_channel',
    );
    expect(columnOf(notificationReceipts, 'destination').notNull).toBe(true);
    expect(columnOf(notificationReceipts, 'status').notNull).toBe(true);
    expect(columnOf(notificationReceipts, 'template').notNull).toBe(false);
    expect(checkNames(notificationReceipts)).toEqual([
      'notification_receipts_status_known',
      'notification_receipts_error_length',
    ]);
  });
});
