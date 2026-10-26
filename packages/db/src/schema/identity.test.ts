import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  consentRecords,
  organizations,
  profiles,
  staffInvitations,
  webauthnCredentials,
} from './identity.js';

/** Column names of a table, in declaration order. */
function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

const TABLES = [
  ['organizations', organizations],
  ['profiles', profiles],
  ['staff_invitations', staffInvitations],
  ['webauthn_credentials', webauthnCredentials],
  ['consent_records', consentRecords],
] as const;

describe('identity tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });

  it('models organizations with a unique human client code', () => {
    expect(columnNames(organizations)).toEqual([
      'id',
      'name',
      'client_code',
      'primary_domain',
      'industry',
      'country',
      'stripe_customer_id',
      'paystack_customer_code',
      'created_at',
      'updated_at',
    ]);
    const config = getTableConfig(organizations);
    expect(config.columns.find((column) => column.name === 'client_code')?.isUnique).toBe(true);
    // Case-insensitive lookup index on the organisation name.
    expect(config.indexes).toHaveLength(1);
  });

  it('mirrors auth.users in profiles and keeps the security attributes', () => {
    expect(columnNames(profiles)).toEqual([
      'id',
      'org_id',
      'email',
      'full_name',
      'job_title',
      'phone',
      'country',
      'account_type',
      'role',
      'account_status',
      'team',
      'access_tier',
      'base_location',
      'scope_summary',
      'scope_notes',
      'mfa_enrolled',
      'mfa_methods',
      'joined_at',
      'last_active_at',
      'access_review_due',
      'suspended_at',
      'suspended_reason',
      'deleted_at',
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
      'created_at',
      'updated_at',
    ]);

    const config = getTableConfig(profiles);
    const id = config.columns.find((column) => column.name === 'id');
    expect(id?.primary).toBe(true);
    // No server default: the id comes from `auth.users`.
    expect(id?.hasDefault).toBe(false);
    expect(config.foreignKeys.map((key) => key.getName())).toContain('profiles_id_users_id_fk');
    expect(config.foreignKeys.map((key) => key.getName())).toContain(
      'profiles_org_id_organizations_id_fk',
    );
    expect(config.columns.find((column) => column.name === 'email')?.isUnique).toBe(true);
    expect(config.columns.find((column) => column.name === 'role')?.default).toBeDefined();
    expect(config.indexes.map((idx) => idx.config.name)).toEqual([
      'profiles_role_idx',
      'profiles_account_status_idx',
      'profiles_org_id_idx',
      'profiles_last_active_at_idx',
    ]);
  });

  it('stores only a hashed invitation token and defaults the checklist', () => {
    expect(columnNames(staffInvitations)).toEqual([
      'id',
      'email',
      'full_name',
      'job_title',
      'base_location',
      'role',
      'team',
      'access_tier',
      'scope_notes',
      'access_review_due',
      'invited_by',
      'token_hash',
      'status',
      'expires_at',
      'accepted_at',
      'revoked_at',
      'resend_count',
      'checklist',
      'created_at',
      'updated_at',
    ]);
    const config = getTableConfig(staffInvitations);
    expect(columnNames(staffInvitations)).not.toContain('token');
    expect(config.columns.find((column) => column.name === 'token_hash')?.isUnique).toBe(true);
    expect(config.columns.find((column) => column.name === 'expires_at')?.notNull).toBe(true);
    expect(config.columns.find((column) => column.name === 'checklist')?.default).toEqual({
      mfaEnrolmentMandatory: true,
      ndaOnFile: false,
      backgroundVerified: false,
      trainingAcknowledged: false,
    });
    expect(config.indexes.map((idx) => idx.config.name)).toEqual([
      'staff_invitations_status_expires_at_idx',
      'staff_invitations_email_idx',
    ]);
  });

  it('stores WebAuthn public keys as bytes and cascades with the profile', () => {
    expect(columnNames(webauthnCredentials)).toEqual([
      'id',
      'user_id',
      'credential_id',
      'public_key',
      'counter',
      'transports',
      'device_name',
      'created_at',
      'last_used_at',
    ]);
    const config = getTableConfig(webauthnCredentials);
    expect(config.columns.find((column) => column.name === 'credential_id')?.isUnique).toBe(true);
    expect(config.foreignKeys.map((key) => key.getName())).toContain(
      'webauthn_credentials_user_id_profiles_id_fk',
    );
  });

  it('requires a known or anonymous actor on every consent record', () => {
    expect(columnNames(consentRecords)).toEqual([
      'id',
      'user_id',
      'anonymous_id',
      'categories',
      'policy_version',
      'ip_hash',
      'user_agent',
      'created_at',
    ]);
    const config = getTableConfig(consentRecords);
    expect(config.checks.map((constraint) => constraint.name)).toEqual([
      'consent_records_actor_check',
    ]);
    // Append-only: no updated_at column.
    expect(columnNames(consentRecords)).not.toContain('updated_at');
  });
});
