import type { MfaMethod, UserRole } from '@vunvault/contracts';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Account-security data access: recovery codes, WebAuthn credentials, the profile
 * security columns and other-session revocation.
 *
 * A repo never decides policy — it reads and writes rows. `service.ts` owns the
 * rules (last-factor protection, counter regression, one batch at a time).
 */

export interface WebauthnKeyRow {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface SecurityProfileRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mfaEnrolled: boolean;
  mfaMethods: MfaMethod[];
  require2fa: boolean;
  lastPasswordChangeAt: Date | null;
  lastFactorChangeAt: Date | null;
}

export interface RecoveryBatchRow {
  batchId: string;
  generatedAt: Date;
  total: number;
  unused: number;
}

export interface NewWebauthnCredential {
  userId: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  deviceName: string | null;
}

export interface AccountSecurityRepo {
  getSecurityProfile(userId: string): Promise<SecurityProfileRow | null>;
  listRecoveryBatches(userId: string): Promise<RecoveryBatchRow[]>;
  insertRecoveryCodes(userId: string, batchId: string, codeHashes: string[]): Promise<void>;
  markUnusedCodesUsed(userId: string, at: Date): Promise<number>;
  consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean>;
  listWebauthnCredentials(userId: string): Promise<WebauthnKeyRow[]>;
  findWebauthnCredential(credentialId: string): Promise<WebauthnKeyRow | null>;
  insertWebauthnCredential(input: NewWebauthnCredential): Promise<WebauthnKeyRow>;
  deleteWebauthnCredential(id: string, userId: string): Promise<boolean>;
  updateCredentialCounter(id: string, counter: number, at: Date): Promise<void>;
  setLastPasswordChangeAt(userId: string, at: Date): Promise<void>;
  setLastFactorChangeAt(userId: string, at: Date): Promise<void>;
  setMfaState(userId: string, enrolled: boolean, methods: MfaMethod[]): Promise<void>;
  revokeOtherSessions(userId: string, keepSessionId: string | null, at: Date): Promise<number>;
}

interface SqlProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  mfa_enrolled: boolean;
  mfa_methods: MfaMethod[] | string;
  require_2fa: boolean;
  last_password_change_at: Date | string | null;
  last_factor_change_at: Date | string | null;
}

interface SqlCredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: string | number;
  transports: string[] | string | null;
  device_name: string | null;
  created_at: Date | string;
  last_used_at: Date | string | null;
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function parseMethods(value: MfaMethod[] | string): MfaMethod[] {
  if (Array.isArray(value)) return value;
  const trimmed = value.replace(/[{}"]/g, '');
  return trimmed === '' ? [] : (trimmed.split(',') as MfaMethod[]);
}

function parseTransports(value: string[] | string | null): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value;
  const trimmed = value.replace(/[{}"]/g, '');
  return trimmed === '' ? [] : trimmed.split(',');
}

export class SqlAccountSecurityRepo implements AccountSecurityRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async getSecurityProfile(userId: string): Promise<SecurityProfileRow | null> {
    const rows = await this.executor.unsafe<SqlProfileRow[]>(
      `select id::text as id, email::text as email, full_name, role::text as role,
              mfa_enrolled, mfa_methods, require_2fa,
              last_password_change_at, last_factor_change_at
         from profiles where id = $1::uuid limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      mfaEnrolled: row.mfa_enrolled,
      mfaMethods: parseMethods(row.mfa_methods),
      require2fa: row.require_2fa,
      lastPasswordChangeAt: toDate(row.last_password_change_at),
      lastFactorChangeAt: toDate(row.last_factor_change_at),
    };
  }

  async listRecoveryBatches(userId: string): Promise<RecoveryBatchRow[]> {
    const rows = await this.executor.unsafe<
      Array<{
        batch_id: string;
        generated_at: Date | string;
        total: string | number;
        unused: string | number;
      }>
    >(
      `select batch_id::text as batch_id, min(created_at) as generated_at,
              count(*)::text as total,
              count(*) filter (where used_at is null)::text as unused
         from user_recovery_codes
        where user_id = $1::uuid
        group by batch_id
        order by min(created_at) desc`,
      [userId],
    );
    return rows.map((row) => ({
      batchId: row.batch_id,
      generatedAt: toDate(row.generated_at) as Date,
      total: Number(row.total),
      unused: Number(row.unused),
    }));
  }

  async insertRecoveryCodes(userId: string, batchId: string, codeHashes: string[]): Promise<void> {
    for (const hash of codeHashes) {
      await this.executor.unsafe(
        `insert into user_recovery_codes (user_id, batch_id, code_hash)
         values ($1::uuid, $2::uuid, $3)`,
        [userId, batchId, hash],
      );
    }
  }

  async markUnusedCodesUsed(userId: string, at: Date): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ updated: string | number }>>(
      `with marked as (
         update user_recovery_codes set used_at = $2
          where user_id = $1::uuid and used_at is null
          returning id
       ) select count(*)::text as updated from marked`,
      [userId, at],
    );
    return Number(rows[0]?.updated ?? 0);
  }

  async consumeRecoveryCode(userId: string, codeHash: string, at: Date): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update user_recovery_codes set used_at = $3
        where user_id = $1::uuid and code_hash = $2 and used_at is null
        returning id::text as id`,
      [userId, codeHash, at],
    );
    return (rows[0]?.id ?? '') !== '';
  }

  async listWebauthnCredentials(userId: string): Promise<WebauthnKeyRow[]> {
    const rows = await this.executor.unsafe<SqlCredentialRow[]>(
      `select id::text as id, user_id::text as user_id, credential_id, public_key,
              counter::text as counter, transports, device_name, created_at, last_used_at
         from webauthn_credentials where user_id = $1::uuid order by created_at asc`,
      [userId],
    );
    return rows.map(toCredential);
  }

  async findWebauthnCredential(credentialId: string): Promise<WebauthnKeyRow | null> {
    const rows = await this.executor.unsafe<SqlCredentialRow[]>(
      `select id::text as id, user_id::text as user_id, credential_id, public_key,
              counter::text as counter, transports, device_name, created_at, last_used_at
         from webauthn_credentials where credential_id = $1 limit 1`,
      [credentialId],
    );
    const row = rows[0];
    return row === undefined ? null : toCredential(row);
  }

  async insertWebauthnCredential(input: NewWebauthnCredential): Promise<WebauthnKeyRow> {
    const rows = await this.executor.unsafe<SqlCredentialRow[]>(
      `insert into webauthn_credentials (user_id, credential_id, public_key, counter, transports, device_name)
       values ($1::uuid, $2, $3::bytea, $4, $5, $6)
       returning id::text as id, user_id::text as user_id, credential_id, public_key,
                 counter::text as counter, transports, device_name, created_at, last_used_at`,
      [
        input.userId,
        input.credentialId,
        input.publicKey.toString('hex'),
        input.counter,
        `{${input.transports.join(',')}}`,
        input.deviceName,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('could not store the WebAuthn credential');
    return toCredential(row);
  }

  async deleteWebauthnCredential(id: string, userId: string): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `delete from webauthn_credentials where id = $1::uuid and user_id = $2::uuid
       returning id::text as id`,
      [id, userId],
    );
    return (rows[0]?.id ?? '') !== '';
  }

  async updateCredentialCounter(id: string, counter: number, at: Date): Promise<void> {
    await this.executor.unsafe(
      'update webauthn_credentials set counter = $2, last_used_at = $3 where id = $1::uuid',
      [id, counter, at],
    );
  }

  async setLastPasswordChangeAt(userId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      'update profiles set last_password_change_at = $2 where id = $1::uuid',
      [userId, at],
    );
  }

  async setLastFactorChangeAt(userId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      'update profiles set last_factor_change_at = $2 where id = $1::uuid',
      [userId, at],
    );
  }

  async setMfaState(userId: string, enrolled: boolean, methods: MfaMethod[]): Promise<void> {
    await this.executor.unsafe(
      `update profiles set mfa_enrolled = $2, mfa_methods = $3 where id = $1::uuid`,
      [userId, enrolled, `{${methods.join(',')}}`],
    );
  }

  async revokeOtherSessions(
    userId: string,
    keepSessionId: string | null,
    at: Date,
  ): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ revoked: string | number }>>(
      `with revoked as (
         update user_sessions set revoked_at = $3
          where user_id = $1::uuid
            and revoked_at is null
            and ($2::uuid is null or id <> $2::uuid)
          returning id
       ) select count(*)::text as revoked from revoked`,
      [userId, keepSessionId, at],
    );
    return Number(rows[0]?.revoked ?? 0);
  }
}

function toCredential(row: SqlCredentialRow): WebauthnKeyRow {
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: Buffer.isBuffer(row.public_key) ? row.public_key : Buffer.from(row.public_key),
    counter: Number(row.counter),
    transports: parseTransports(row.transports),
    deviceName: row.device_name,
    createdAt: toDate(row.created_at) as Date,
    lastUsedAt: toDate(row.last_used_at),
  };
}
