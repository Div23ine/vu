import { randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin';
import { HttpError } from '../../../lib/http-error';

import type { AuthFlowStore } from './challenge';
import { newSessionId, sixDigitCode, type AuthFlowRecord } from './challenge';
import { deviceLabel, geoCity, geoCountry, type GeoHeaders } from './device';
import type { AuthProfileRow, AuthRepo, NewProfile } from './repo';

/**
 * Passwordless authentication: mailbox possession, then a six-digit code.
 *
 * Login:   email -> confirmation link -> 6-digit code (email OTP, or the
 *          enrolled TOTP authenticator) -> session.
 * Signup:  email + name -> confirmation link -> 6-digit code -> ONLY NOW the
 *          Supabase auth user and the profile row are created, then session.
 *
 * An abandoned signup therefore leaves NOTHING in Supabase: pending state
 * lives in Redis with a TTL, never in `auth.users`. Unknown addresses get the
 * same 202 as known ones — the flow never confirms whether an account exists.
 */

export interface PasswordlessMeta {
  ip: string;
  userAgent?: string | null;
  headers?: GeoHeaders;
}

export interface PasswordlessDeps {
  repo: AuthRepo;
  supabase: SupabaseAdmin;
  flows: AuthFlowStore;
  sendMail: (input: { to: string; subject: string; text: string }) => Promise<void>;
  webOrigin: string;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void };
}

export interface PasswordlessSession {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  sessionId: string;
  userId: string;
  email: string;
  mfaMethod: 'email_otp' | 'totp';
}

function token(): string {
  return randomBytes(24).toString('base64url');
}

export class PasswordlessService {
  private readonly deps: PasswordlessDeps;
  private readonly now: () => Date;

  constructor(deps: PasswordlessDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  // ------------------------------------------------------------------ login

  async startLogin(email: string): Promise<{ sent: boolean }> {
    const address = email.trim().toLowerCase();
    const profile = await this.deps.repo.findProfileByEmail(address);
    if (profile === null || profile.accountStatus !== 'active' || profile.deletedAt !== null) {
      return { sent: false };
    }
    const flowToken = token();
    await this.deps.flows.putLink(flowToken, { email: address });
    await this.deps.sendMail({
      to: address,
      subject: 'Confirm your VUNVAULT sign-in',
      text: `Confirm this sign-in attempt:\n${this.deps.webOrigin}/login/confirm?token=${flowToken}\n\nThe link expires in 15 minutes. If this was not you, ignore this email — nothing happens without the link and your six-digit code.`,
    });
    return { sent: true };
  }

  async confirmLogin(flowToken: string): Promise<{ handle: string; method: 'email' | 'totp' }> {
    const record = await this.requireLink(flowToken);
    const profile = await this.deps.repo.findProfileByEmail(record.email);
    let method: 'email' | 'totp' = 'email';
    if (profile !== null) {
      const factors = await this.deps.supabase.mfa.listFactors(profile.id).catch(() => []);
      if (factors.some((factor) => factor.verified)) method = 'totp';
    }
    if (method === 'email') {
      const code = sixDigitCode();
      await this.deps.flows.advanceToCode(flowToken, { ...record, method }, code);
      await this.deps.sendMail({
        to: record.email,
        subject: 'Your VUNVAULT sign-in code',
        text: `Your six-digit code is ${code}. It expires in 5 minutes. Never share it.`,
      });
    } else {
      await this.deps.flows.advanceToCode(flowToken, { ...record, method }, '');
    }
    return { handle: flowToken, method };
  }

  async verifyLogin(
    flowToken: string,
    code: string,
    meta: PasswordlessMeta,
  ): Promise<PasswordlessSession> {
    const record = await this.requireCode(flowToken);
    const profile = await this.deps.repo.findProfileByEmail(record.email);
    if (profile === null || profile.accountStatus !== 'active') {
      throw HttpError.unauthorized('login_failed');
    }
    return this.completeSession(flowToken, record, profile, code, meta);
  }

  // ----------------------------------------------------------------- signup

  async startSignup(email: string, fullName: string): Promise<{ sent: boolean }> {
    const address = email.trim().toLowerCase();
    const existing = await this.deps.repo.findProfileByEmail(address);
    if (existing !== null && existing.deletedAt === null) {
      // Silent: an existing account must not be probeable through signup.
      return { sent: false };
    }
    const flowToken = token();
    await this.deps.flows.putLink(flowToken, {
      email: address,
      userId: randomUUID(),
      fullName: fullName.trim(),
    });
    await this.deps.sendMail({
      to: address,
      subject: 'Confirm your VUNVAULT account',
      text: `Confirm your address to finish creating your account:\n${this.deps.webOrigin}/signup/confirm?token=${flowToken}\n\nThe link expires in 15 minutes. Your account is created only after you confirm AND enter the six-digit code that follows.`,
    });
    return { sent: true };
  }

  async confirmSignup(flowToken: string): Promise<{ handle: string; method: 'email' }> {
    const record = await this.requireLink(flowToken);
    const code = sixDigitCode();
    await this.deps.flows.advanceToCode(flowToken, { ...record, method: 'email' }, code);
    await this.deps.sendMail({
      to: record.email,
      subject: 'Your VUNVAULT account code',
      text: `Your six-digit code is ${code}. It expires in 5 minutes. Never share it.`,
    });
    return { handle: flowToken, method: 'email' };
  }

  async verifySignup(
    flowToken: string,
    code: string,
    meta: PasswordlessMeta,
  ): Promise<PasswordlessSession> {
    const record = await this.requireCode(flowToken);
    if (record.userId === undefined) throw HttpError.unauthorized('signup_failed');

    // The Supabase auth user is created HERE — at completion — never before.
    const created = await this.deps.supabase.createUser({
      id: record.userId,
      email: record.email,
      password: randomBytes(32).toString('base64url'),
      emailConfirm: true,
      userMetadata: { full_name: record.fullName ?? record.email },
    });
    const profileInput: NewProfile = {
      id: created.id,
      orgId: null,
      email: record.email,
      fullName: record.fullName ?? record.email,
      firstName: null,
      lastName: null,
      role: 'client',
      accountStatus: 'active',
      phone: null,
      country: null,
      accountType: 'individual',
    };
    await this.deps.repo.createProfile(profileInput);
    const profile = await this.deps.repo.findProfileByEmail(record.email);
    if (profile === null) throw HttpError.unauthorized('signup_failed');
    return this.completeSession(flowToken, record, profile, code, meta);
  }

  // ---------------------------------------------------------------- shared

  private async completeSession(
    flowToken: string,
    record: AuthFlowRecord,
    profile: AuthProfileRow,
    code: string,
    meta: PasswordlessMeta,
  ): Promise<PasswordlessSession> {
    if (record.method === 'totp') {
      // The aal1 session is minted server-side, then the enrolled factor
      // raises it — the code comes from the user's authenticator app.
      const aal1 = await this.deps.supabase.issueSession(record.email);
      const factors = await this.deps.supabase.mfa.listFactors(profile.id);
      const factor = factors.find((candidate) => candidate.verified);
      if (factor === undefined) throw HttpError.unauthorized('mfa_failed');
      const session = await this.deps.supabase.mfa.challengeAndVerify(
        aal1.accessToken,
        factor.id,
        code,
      );
      await this.deps.flows.clear(flowToken);
      return this.persist(session, profile, 'totp', meta);
    }
    const ok = await this.deps.flows.verifyCode(flowToken, record, code);
    if (!ok) throw HttpError.unauthorized('mfa_failed');
    await this.deps.flows.clear(flowToken);
    const session = await this.deps.supabase.issueSession(record.email);
    return this.persist(session, profile, 'email_otp', meta);
  }

  private async persist(
    session: SupabaseSession,
    profile: AuthProfileRow,
    mfaMethod: 'email_otp' | 'totp',
    meta: PasswordlessMeta,
  ): Promise<PasswordlessSession> {
    const sessionId = session.sessionId === '' ? newSessionId() : session.sessionId;
    const headers = meta.headers ?? {};
    await this.deps.repo.createSession({
      id: sessionId,
      userId: profile.id,
      deviceLabel: deviceLabel(meta.userAgent ?? null),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip,
      geoCity: geoCity(headers),
      geoCountry: geoCountry(headers),
      mfaMethod,
    });
    await this.deps.repo.touchProfileLastActive(profile.id, this.now());
    return {
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
      sessionId,
      userId: profile.id,
      email: profile.email,
      mfaMethod,
    };
  }

  private async requireLink(flowToken: string): Promise<AuthFlowRecord> {
    const record = await this.deps.flows.get(flowToken);
    if (record === null || record.stage !== 'link') {
      throw HttpError.unauthorized('invalid_token');
    }
    return record;
  }

  private async requireCode(flowToken: string): Promise<AuthFlowRecord> {
    const record = await this.deps.flows.get(flowToken);
    if (record === null || record.stage !== 'code') {
      throw HttpError.unauthorized('invalid_token');
    }
    return record;
  }
}
