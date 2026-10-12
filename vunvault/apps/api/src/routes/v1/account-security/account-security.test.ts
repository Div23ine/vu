import { describe, expect, it } from 'vitest';
import type { MfaMethod } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import { isStaff } from '../../../lib/staff';
import { memoryKvStore } from '../auth/challenge';
import { computePosture, postureItemDone, PASSWORD_MAX_AGE_DAYS } from './posture';
import { validatePassword, requiredLength } from './password-policy';
import { hashRecoveryCode } from './recovery-codes';
import { AccountSecurityService, WEBAUTHN_AUTHENTICATION_PREFIX } from './service';
import type {
  AccountSecurityRepo,
  RecoveryBatchRow,
  SecurityProfileRow,
  WebauthnKeyRow,
} from './repo';
import type { WebauthnService, RegisteredCredential } from './webauthn';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin';

const USER_ID = 'c0000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-09-24T12:00:00.000Z');

// --------------------------------------------------------------------- fakes

class FakeSecurityRepo implements AccountSecurityRepo {
  profile: SecurityProfileRow = {
    id: USER_ID,
    email: 'e.reed@vunvault.com',
    fullName: 'Dr. Evelyn Reed',
    role: 'super_admin',
    mfaEnrolled: true,
    mfaMethods: ['totp'],
    require2fa: true,
    lastPasswordChangeAt: new Date('2026-09-01T00:00:00.000Z'),
    lastFactorChangeAt: new Date('2026-08-12T00:00:00.000Z'),
  };
  codes: Array<{ batchId: string; hash: string; usedAt: Date | null; createdAt: Date }> = [];
  credentials: WebauthnKeyRow[] = [];
  revokedOthers: Array<{ keep: string | null; at: Date }> = [];
  passwordChanges: Date[] = [];
  factorChanges: Date[] = [];
  mfaState: Array<{ enrolled: boolean; methods: MfaMethod[] }> = [];
  private sequence = 0;

  async getSecurityProfile() {
    return this.profile;
  }
  async listRecoveryBatches(): Promise<RecoveryBatchRow[]> {
    const byBatch = new Map<string, RecoveryBatchRow>();
    for (const code of this.codes) {
      const existing = byBatch.get(code.batchId);
      if (existing === undefined) {
        byBatch.set(code.batchId, {
          batchId: code.batchId,
          generatedAt: code.createdAt,
          total: 1,
          unused: code.usedAt === null ? 1 : 0,
        });
      } else {
        existing.total += 1;
        if (code.usedAt === null) existing.unused += 1;
      }
    }
    return [...byBatch.values()].sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }
  async insertRecoveryCodes(_userId: string, batchId: string, hashes: string[]) {
    for (const hash of hashes) {
      this.codes.push({ batchId, hash, usedAt: null, createdAt: NOW });
    }
  }
  async markUnusedCodesUsed(_userId: string, at: Date) {
    let marked = 0;
    for (const code of this.codes) {
      if (code.usedAt === null) {
        code.usedAt = at;
        marked += 1;
      }
    }
    return marked;
  }
  async consumeRecoveryCode(_userId: string, hash: string, at: Date) {
    const code = this.codes.find((c) => c.hash === hash && c.usedAt === null);
    if (code === undefined) return false;
    code.usedAt = at;
    return true;
  }
  async listWebauthnCredentials() {
    return this.credentials;
  }
  async findWebauthnCredential(credentialId: string) {
    return this.credentials.find((c) => c.credentialId === credentialId) ?? null;
  }
  async insertWebauthnCredential(
    input: Parameters<AccountSecurityRepo['insertWebauthnCredential']>[0],
  ) {
    this.sequence += 1;
    const row: WebauthnKeyRow = {
      id: `key-${this.sequence}`,
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter,
      transports: input.transports,
      deviceName: input.deviceName,
      createdAt: NOW,
      lastUsedAt: null,
    };
    this.credentials.push(row);
    return row;
  }
  async deleteWebauthnCredential(id: string, userId: string) {
    const index = this.credentials.findIndex((c) => c.id === id && c.userId === userId);
    if (index === -1) return false;
    this.credentials.splice(index, 1);
    return true;
  }
  async updateCredentialCounter(id: string, counter: number, at: Date) {
    const row = this.credentials.find((c) => c.id === id);
    if (row !== undefined) {
      row.counter = counter;
      row.lastUsedAt = at;
    }
  }
  async setLastPasswordChangeAt(_userId: string, at: Date) {
    this.passwordChanges.push(at);
  }
  async setLastFactorChangeAt(_userId: string, at: Date) {
    this.factorChanges.push(at);
  }
  async setMfaState(_userId: string, enrolled: boolean, methods: MfaMethod[]) {
    this.mfaState.push({ enrolled, methods });
    this.profile.mfaEnrolled = enrolled;
    this.profile.mfaMethods = methods;
  }
  async revokeOtherSessions(_userId: string, keepSessionId: string | null, at: Date) {
    this.revokedOthers.push({ keep: keepSessionId, at });
    return 2;
  }
}

interface FakeSupabaseState {
  passwordCalls: string[];
  signOutCalls: Array<{ scope: string }>;
  unenrolled: string[];
  factors: Array<{ id: string; type: 'totp'; verified: boolean }>;
  passwordValid: boolean;
}

function fakeSupabase(overrides: Partial<SupabaseAdmin> = {}): SupabaseAdmin & {
  state: FakeSupabaseState;
} {
  const state: FakeSupabaseState = {
    passwordCalls: [],
    signOutCalls: [],
    unenrolled: [],
    factors: [{ id: 'factor-1', type: 'totp', verified: true }],
    passwordValid: true,
  };
  const admin = {
    createUser: async () => ({ id: USER_ID }),
    signInWithPassword: async () => {
      if (!state.passwordValid) throw new Error('invalid');
      return { session: null, userId: USER_ID, mfaRequired: false, factors: [] };
    },
    refresh: async (): Promise<SupabaseSession> => {
      throw new Error('not used');
    },
    signOut: async (_token: string, scope: 'global' | 'local' | 'others') => {
      state.signOutCalls.push({ scope });
    },
    updatePassword: async (_userId: string, password: string) => {
      state.passwordCalls.push(password);
    },
    deleteSession: async () => undefined,
    confirmEmail: async () => undefined,
    issueSession: async (): Promise<SupabaseSession> => {
      throw new Error('not used');
    },
    deleteUser: async () => undefined,
    buildAuthorizeUrl: (): string => {
      throw new Error('not used');
    },
    exchangeCodeForSession: async (): Promise<{
      session: SupabaseSession;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        fullName: string | null;
        avatarUrl: string | null;
      };
    }> => {
      throw new Error('not used');
    },
    mfa: {
      enrollTotp: async () => ({
        factorId: 'factor-2',
        qrSvg: '<svg/>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/VUNVAULT',
      }),
      challengeAndVerify: async (_t: string, _f: string, code: string) => {
        if (code !== '481920') throw new Error('bad code');
        return {
          accessToken: 'aal2',
          refreshToken: 'rt',
          expiresIn: 3600,
          sessionId: 'session-2',
          userId: USER_ID,
          aal: 'aal2' as const,
        };
      },
      unenroll: async (_t: string, factorId: string) => {
        state.unenrolled.push(factorId);
      },
      listFactors: async () => state.factors,
    },
    ...overrides,
    state,
  };
  return Object.assign(admin, { state }) as never;
}

function fakeWebauthn(overrides: Partial<WebauthnService> = {}): WebauthnService & {
  state: { counter: number; verified: boolean };
} {
  const state = { counter: 5, verified: true };
  const service: WebauthnService = {
    startRegistration: async () => ({
      options: { challenge: 'reg-challenge' },
      challenge: 'reg-challenge',
    }),
    finishRegistration: async (): Promise<RegisteredCredential> => ({
      credentialId: 'cred-1',
      publicKey: Buffer.from('public-key'),
      counter: state.counter,
      transports: ['usb'],
    }),
    startAuthentication: async () => ({
      options: { challenge: 'auth-challenge' },
      challenge: 'auth-challenge',
    }),
    finishAuthentication: async () => ({ verified: state.verified, counter: state.counter }),
    ...overrides,
  };
  return Object.assign(service, { state });
}

function makeService(options: { role?: 'super_admin' | 'client' } = {}) {
  const repo = new FakeSecurityRepo();
  if (options.role !== undefined) repo.profile.role = options.role;
  const supabase = fakeSupabase();
  const webauthn = fakeWebauthn();
  const kv = memoryKvStore();
  const service = new AccountSecurityService({
    repo,
    supabase,
    webauthn,
    breach: { isBreached: async () => false },
    kv,
    now: () => NOW,
  });
  return { service, repo, supabase, webauthn, kv };
}

const CONTEXT = {
  userId: USER_ID,
  email: 'e.reed@vunvault.com',
  role: 'super_admin',
  accessToken: 'access-token',
  sessionId: 'session-current',
};

// ------------------------------------------------------------- password policy

describe('validatePassword', () => {
  it('requires 14 characters for staff and 12 for clients', () => {
    expect(requiredLength('super_admin')).toBe(14);
    expect(requiredLength('security_analyst')).toBe(14);
    expect(requiredLength('client')).toBe(12);
    expect(isStaff('support_engineer')).toBe(true);

    const thirteen = 'Abcdefghijkl1!';
    expect(thirteen).toHaveLength(14 - 1 + 1);
    expect(validatePassword('Abcdefghij1!', 'super_admin').valid).toBe(false); // 12 chars
    expect(validatePassword('Abcdefghijk1!', 'super_admin').valid).toBe(false); // 13 chars
    expect(validatePassword('Abcdefghijkl1!', 'super_admin').valid).toBe(true); // 14 chars
    expect(validatePassword('Abcdefghij1!', 'client').valid).toBe(true); // 12 chars
    expect(validatePassword('Abcdefghi1!', 'client').valid).toBe(false); // 11 chars
    void thirteen;
  });

  it('requires every character class and rejects reuse', () => {
    const issues = validatePassword('alllowercase', 'client').issues.map((i) => i.rule);
    expect(issues).toContain('upper');
    expect(issues).toContain('digit');
    expect(issues).toContain('symbol');
    expect(validatePassword('NoDigitsHere!', 'client').issues.map((i) => i.rule)).toContain(
      'digit',
    );
    expect(validatePassword('NoSymbol12345', 'client').issues.map((i) => i.rule)).toContain(
      'symbol',
    );
    expect(
      validatePassword('Str0ng-Pass!', 'client', 'Str0ng-Pass!').issues.map((i) => i.rule),
    ).toContain('reuse');
  });
});

describe('changePassword', () => {
  it('revokes every other session and records the change', async () => {
    const { service, repo, supabase } = makeService();
    const result = await service.changePassword(
      {
        currentPassword: 'Old-Password-1!',
        newPassword: 'New-Password-2@',
        confirmPassword: 'New-Password-2@',
      },
      CONTEXT,
    );

    expect(result.revokedSessions).toBe(2);
    expect(repo.revokedOthers).toEqual([{ keep: 'session-current', at: NOW }]);
    expect(supabase.state.signOutCalls).toEqual([{ scope: 'others' }]);
    expect(supabase.state.passwordCalls).toEqual(['New-Password-2@']);
    expect(repo.passwordChanges).toEqual([NOW]);
  });

  it('refuses a wrong current password and revokes nothing', async () => {
    const { repo } = makeService();
    const supabase = fakeSupabase();
    supabase.state.passwordValid = false;
    const service = new AccountSecurityService({
      repo,
      supabase,
      webauthn: fakeWebauthn(),
      breach: { isBreached: async () => false },
      kv: memoryKvStore(),
      now: () => NOW,
    });

    const error = await service
      .changePassword(
        {
          currentPassword: 'wrong',
          newPassword: 'New-Password-2@',
          confirmPassword: 'New-Password-2@',
        },
        CONTEXT,
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(401);
    expect((error as HttpError).code).toBe('invalid_credentials');
    expect(repo.revokedOthers).toHaveLength(0);
    expect(repo.passwordChanges).toHaveLength(0);
    expect(supabase.state.passwordCalls).toHaveLength(0);
  });

  it('refuses a breached password and a staff password that is too short', async () => {
    const repo = new FakeSecurityRepo();
    const service = new AccountSecurityService({
      repo,
      supabase: fakeSupabase(),
      webauthn: fakeWebauthn(),
      breach: { isBreached: async () => true },
      kv: memoryKvStore(),
      now: () => NOW,
    });
    const breached = await service
      .changePassword(
        {
          currentPassword: 'Old-Password-1!',
          newPassword: 'New-Password-2@',
          confirmPassword: 'New-Password-2@',
        },
        CONTEXT,
      )
      .catch((caught: unknown) => caught);
    expect((breached as HttpError).code).toBe('breached_password');
    expect(repo.passwordChanges).toHaveLength(0);

    const { service: strict } = makeService();
    const tooShort = await strict
      .changePassword(
        {
          currentPassword: 'Old-Password-1!',
          newPassword: 'Only13Chars1!',
          confirmPassword: 'Only13Chars1!',
        },
        CONTEXT,
      )
      .catch((caught: unknown) => caught);
    expect((tooShort as HttpError).code).toBe('validation_failed');
    expect((tooShort as HttpError).details).toEqual([
      { path: ['newPassword'], rule: 'len', message: 'At least 14 characters' },
    ]);
  });
});

// ---------------------------------------------------------------- TOTP + keys

describe('TOTP', () => {
  it('enrols with the fixed friendly name', async () => {
    const { service } = makeService();
    const enrollment = await service.enrollTotp('access-token');
    expect(enrollment).toMatchObject({ factorId: 'factor-2', secret: 'JBSWY3DPEHPK3PXP' });
  });

  it('marks the account enrolled on a correct code and refuses a wrong one', async () => {
    const { service, repo } = makeService();
    repo.profile.mfaMethods = [];
    const session = await service.verifyTotp('access-token', USER_ID, 'factor-2', '481920');
    expect(session.aal).toBe('aal2');
    expect(repo.mfaState).toEqual([{ enrolled: true, methods: ['totp'] }]);
    expect(repo.factorChanges).toEqual([NOW]);

    const failed = await service
      .verifyTotp('access-token', USER_ID, 'factor-2', '000000')
      .catch((caught: unknown) => caught);
    expect((failed as HttpError).code).toBe('mfa_failed');
  });

  it('refuses to remove a staff member’s last factor', async () => {
    const { service, repo, supabase } = makeService();
    repo.credentials = [];
    const error = await service
      .disableTotp('access-token', USER_ID)
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(422);
    expect((error as HttpError).code).toBe('last_factor');
    expect(supabase.state.unenrolled).toHaveLength(0);
  });

  it('allows removal when a hardware key remains', async () => {
    const { service, repo, supabase } = makeService();
    repo.credentials = [
      {
        id: 'key-1',
        userId: USER_ID,
        credentialId: 'cred-1',
        publicKey: Buffer.from('k'),
        counter: 1,
        transports: [],
        deviceName: 'YubiKey 5C NFC',
        createdAt: NOW,
        lastUsedAt: null,
      },
    ];
    await service.disableTotp('access-token', USER_ID);
    expect(supabase.state.unenrolled).toEqual(['factor-1']);
    expect(repo.mfaState.at(-1)).toEqual({ enrolled: true, methods: ['webauthn'] });
  });
});

describe('WebAuthn', () => {
  it('stores the registration challenge for five minutes', async () => {
    const { service, kv } = makeService();
    const options = await service.startWebauthnRegistration({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      displayName: 'Dr. Evelyn Reed',
    });
    expect(options).toEqual({ challenge: 'reg-challenge' });
    expect(kv.entries.get(`wa:reg:${USER_ID}`)?.value).toBe('reg-challenge');
  });

  it('registers a key and marks the account enrolled', async () => {
    const { service, repo, kv } = makeService();
    await service.startWebauthnRegistration({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      displayName: 'Dr. Evelyn Reed',
    });
    repo.profile.mfaMethods = [];

    const key = await service.finishWebauthnRegistration(USER_ID, 'YubiKey 5C NFC', {
      id: 'cred-1',
    });
    expect(key).toMatchObject({ deviceName: 'YubiKey 5C NFC', lastUsedAt: null });
    expect(repo.credentials).toHaveLength(1);
    expect(repo.mfaState.at(-1)).toEqual({ enrolled: true, methods: ['webauthn'] });
    // The challenge is single-use.
    expect(kv.entries.has(`wa:reg:${USER_ID}`)).toBe(false);
  });

  it('refuses an assertion whose counter did not increase', async () => {
    const { service, repo, kv, webauthn } = makeService();
    repo.credentials = [
      {
        id: 'key-1',
        userId: USER_ID,
        credentialId: 'cred-1',
        publicKey: Buffer.from('k'),
        counter: 5,
        transports: [],
        deviceName: null,
        createdAt: NOW,
        lastUsedAt: null,
      },
    ];
    await kv.set(
      `${WEBAUTHN_AUTHENTICATION_PREFIX}handle-1`,
      JSON.stringify({ userId: USER_ID, challenge: 'auth-challenge' }),
      'EX',
      300,
    );

    // The authenticator replays the same counter: a cloned key.
    webauthn.state.counter = 5;
    const replay = await service
      .verifyWebauthnAssertion('handle-1', { id: 'cred-1' })
      .catch((caught: unknown) => caught);
    expect((replay as HttpError).code).toBe('counter_regression');
    expect(repo.credentials[0]?.counter).toBe(5);

    // A genuine increment is accepted and persisted.
    webauthn.state.counter = 6;
    const ok = await service.verifyWebauthnAssertion('handle-1', { id: 'cred-1' });
    expect(ok).toEqual({ userId: USER_ID, credentialId: 'cred-1' });
    expect(repo.credentials[0]?.counter).toBe(6);
    expect(kv.entries.has(`${WEBAUTHN_AUTHENTICATION_PREFIX}handle-1`)).toBe(false);
  });

  it('refuses a key that belongs to another account', async () => {
    const { service, repo, kv } = makeService();
    repo.credentials = [
      {
        id: 'key-1',
        userId: 'a0000000-0000-4000-8000-000000000009',
        credentialId: 'cred-1',
        publicKey: Buffer.from('k'),
        counter: 1,
        transports: [],
        deviceName: null,
        createdAt: NOW,
        lastUsedAt: null,
      },
    ];
    await kv.set(
      `${WEBAUTHN_AUTHENTICATION_PREFIX}handle-2`,
      JSON.stringify({ userId: USER_ID, challenge: 'auth-challenge' }),
      'EX',
      300,
    );
    const error = await service
      .verifyWebauthnAssertion('handle-2', { id: 'cred-1' })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).code).toBe('mfa_failed');
  });

  it('expires a missing challenge', async () => {
    const { service } = makeService();
    const error = await service
      .verifyWebauthnAssertion('nope', { id: 'cred-1' })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(410);
    expect((error as HttpError).code).toBe('challenge_expired');
  });

  it('refuses to delete a staff member’s last factor', async () => {
    const { service, repo, supabase } = makeService();
    // No TOTP factor either: the hardware key really is the last one.
    supabase.state.factors = [];
    repo.credentials = [
      {
        id: 'key-1',
        userId: USER_ID,
        credentialId: 'cred-1',
        publicKey: Buffer.from('k'),
        counter: 1,
        transports: [],
        deviceName: null,
        createdAt: NOW,
        lastUsedAt: null,
      },
    ];
    repo.profile.mfaMethods = [];
    const error = await service
      .deleteWebauthnKey(USER_ID, 'key-1')
      .catch((caught: unknown) => caught);
    expect((error as HttpError).code).toBe('last_factor');
    expect(repo.credentials).toHaveLength(1);
  });

  it('deletes a second key and reports an unknown one as 404', async () => {
    const { service, repo } = makeService();
    const credential = (id: string, credentialId: string): WebauthnKeyRow => ({
      id,
      userId: USER_ID,
      credentialId,
      publicKey: Buffer.from('k'),
      counter: 1,
      transports: [],
      deviceName: null,
      createdAt: NOW,
      lastUsedAt: null,
    });
    repo.credentials = [credential('key-1', 'cred-1'), credential('key-2', 'cred-2')];
    await service.deleteWebauthnKey(USER_ID, 'key-2');
    expect(repo.credentials.map((c) => c.id)).toEqual(['key-1']);

    const missing = await service
      .deleteWebauthnKey(USER_ID, 'key-9')
      .catch((caught: unknown) => caught);
    expect((missing as HttpError).status).toBe(404);
  });
});

// ------------------------------------------------------------- recovery codes

describe('recovery codes', () => {
  it('creates the first batch, stores only hashes, and refuses a second', async () => {
    const { service, repo } = makeService();
    const batch = await service.createRecoveryCodes(USER_ID);
    expect(batch.codes).toHaveLength(10);
    expect(new Set(batch.codes).size).toBe(10);
    expect(batch.batchId).toMatch(/^[0-9a-f-]{36}$/);
    expect(batch.generatedAt).toBe(NOW.toISOString());

    expect(repo.codes).toHaveLength(10);
    for (const stored of repo.codes) {
      expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(batch.codes.map((code) => hashRecoveryCode(code))).toContain(stored.hash);
    }
    // The plaintext never reaches storage.
    for (const code of batch.codes) {
      expect(repo.codes.some((stored) => stored.hash.includes(code.slice(0, 4)))).toBe(false);
    }

    const again = await service.createRecoveryCodes(USER_ID).catch((caught: unknown) => caught);
    expect((again as HttpError).status).toBe(409);
    expect((again as HttpError).code).toBe('already_generated');
  });

  it('invalidates every unused code when regenerating', async () => {
    const { service, repo } = makeService();
    const first = await service.createRecoveryCodes(USER_ID);
    await service.consumeRecoveryCode(USER_ID, first.codes[0] as string);

    const second = await service.regenerateRecoveryCodes(USER_ID);
    expect(second.codes).toHaveLength(10);
    expect(second.batchId).not.toBe(first.batchId);

    // An old, unused code no longer works.
    expect(await service.consumeRecoveryCode(USER_ID, first.codes[1] as string)).toBe(false);
    // A used code cannot be reused.
    expect(await service.consumeRecoveryCode(USER_ID, first.codes[0] as string)).toBe(false);
    // A new code works exactly once.
    expect(await service.consumeRecoveryCode(USER_ID, second.codes[0] as string)).toBe(true);
    expect(await service.consumeRecoveryCode(USER_ID, second.codes[0] as string)).toBe(false);
    expect(repo.codes.filter((c) => c.usedAt !== null).length).toBeGreaterThanOrEqual(10);
  });

  it('rejects a malformed code without touching storage', async () => {
    const { service, repo } = makeService();
    await service.createRecoveryCodes(USER_ID);
    const usedBefore = repo.codes.filter((c) => c.usedAt !== null).length;
    expect(await service.consumeRecoveryCode(USER_ID, 'not-a-code')).toBe(false);
    expect(repo.codes.filter((c) => c.usedAt !== null)).toHaveLength(usedBefore);
  });
});

// ------------------------------------------------------------------- posture

describe('computePosture', () => {
  it('scores 3 of 4 as 75 and calls it Strong posture', () => {
    // The prototype showed 80 here; the formula is authoritative.
    const posture = computePosture({
      webauthnKeyCount: 1,
      recoveryBatchExists: true,
      lastPasswordChangeAt: new Date('2026-09-01T00:00:00.000Z'),
      now: NOW,
    });
    expect(posture).toMatchObject({ score: 75, label: 'Strong posture', completed: 3, total: 4 });
    expect(posture.items.map((item) => item.label)).toEqual([
      'Hardware-key MFA registered',
      'Recovery codes generated',
      'Password updated within 90 days',
      'Register a backup hardware key',
    ]);
    expect(posture.items.map((item) => item.done)).toEqual([true, true, true, false]);
  });

  it('labels Fair and Weak postures at the documented thresholds', () => {
    expect(
      computePosture({
        webauthnKeyCount: 1,
        recoveryBatchExists: true,
        lastPasswordChangeAt: null,
        now: NOW,
      }),
    ).toMatchObject({ score: 50, label: 'Fair posture', completed: 2 });
    expect(
      computePosture({
        webauthnKeyCount: 0,
        recoveryBatchExists: false,
        lastPasswordChangeAt: null,
        now: NOW,
      }),
    ).toMatchObject({ score: 0, label: 'Weak posture', completed: 0 });
  });

  it('counts a password older than 90 days as stale', () => {
    expect(PASSWORD_MAX_AGE_DAYS).toBe(90);
    const stale = new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000);
    expect(
      postureItemDone(
        'password_age',
        {
          webauthnKeyCount: 0,
          recoveryBatchExists: false,
          lastPasswordChangeAt: stale,
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      postureItemDone(
        'backup_key',
        {
          webauthnKeyCount: 2,
          recoveryBatchExists: false,
          lastPasswordChangeAt: null,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('reports the full status shape', async () => {
    const { service, repo } = makeService();
    await service.createRecoveryCodes(USER_ID);
    repo.credentials = [
      {
        id: 'key-1',
        userId: USER_ID,
        credentialId: 'cred-1',
        publicKey: Buffer.from('k'),
        counter: 1,
        transports: ['usb'],
        deviceName: 'YubiKey 5C NFC',
        createdAt: NOW,
        lastUsedAt: null,
      },
    ];
    const status = await service.status(USER_ID);
    expect(status.mfa.totp).toEqual({ enabled: true, factorId: 'factor-1' });
    expect(status.mfa.webauthn.keys).toHaveLength(1);
    expect(status.mfa.recovery).toMatchObject({ generated: true, remaining: 10, total: 10 });
    expect(status.mfa.require2fa).toBe(true);
    expect(status.mfa.lastFactorChangeAt).toBe('2026-08-12T00:00:00.000Z');
    expect(status.posture.score).toBe(75);
  });
});
