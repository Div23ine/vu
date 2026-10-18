import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSIONS,
  type MfaMethod,
  type ProvisionInviteBody,
  type Team,
  type UserRole,
} from '@vunvault/contracts';
import type { HttpError } from '../../../lib/http-error.js';
import type {
  CreateInvitationInput,
  CreateProfileInput,
  InvitationRow,
  RecordSessionInput,
  StaffRow,
  SummaryCounts,
  UsersRepo,
} from './repo.js';
import { MAX_RESENDS, UsersService, initials } from './service.js';
import { hashInvitationToken } from './tokens.js';

const ADMIN_ID = 'b1000000-0000-4000-8000-000000000001';
const OTHER_ADMIN_ID = 'b1000000-0000-4000-8000-000000000002';
const ANALYST_ID = 'b1000000-0000-4000-8000-000000000003';
const NOW = new Date('2026-09-24T12:00:00.000Z');
const TOKEN = 'a'.repeat(43);

const SUPER_ADMIN = { id: ADMIN_ID, email: 'e.reed@vunvault.com', role: 'super_admin' as UserRole };

// --------------------------------------------------------------------- fakes

function staffRow(id: string, overrides: Partial<StaffRow> = {}): StaffRow {
  return {
    id,
    fullName: 'Evelyn Reed',
    email: 'e.reed@vunvault.com',
    jobTitle: 'Head of Threat Intelligence',
    role: 'super_admin',
    team: 'threat_intelligence',
    accountStatus: 'active',
    accessTier: 'elevated',
    baseLocation: 'Nairobi HQ',
    scopeSummary: 'Full platform · All modules',
    mfaEnrolled: true,
    mfaMethods: ['totp'] as MfaMethod[],
    joinedAt: '2024-03-01T09:00:00.000Z',
    lastActiveAt: '2026-09-24T08:00:00.000Z',
    suspendedAt: null,
    accessReviewDue: null,
    ...overrides,
  };
}

class FakeUsersRepo implements UsersRepo {
  staff: Array<StaffRow & { require2fa?: boolean; deletedAt?: string | null }> = [
    staffRow(ADMIN_ID),
    staffRow(OTHER_ADMIN_ID, {
      fullName: 'Samuel Otieno',
      email: 's.otieno@vunvault.com',
      role: 'security_analyst',
      mfaEnrolled: false,
      mfaMethods: [],
    }),
    staffRow(ANALYST_ID, {
      fullName: 'Dr. Amina Yusuf',
      email: 'a.yusuf@vunvault.com',
      role: 'soc_operator',
      accountStatus: 'dormant',
    }),
  ];
  invitations: InvitationRow[] = [];
  sessions: Record<string, string[]> = { [OTHER_ADMIN_ID]: ['sess-1', 'sess-2'] };
  revokedSessions: string[] = [];
  recordedSessions: RecordSessionInput[] = [];
  profiles: CreateProfileInput[] = [];
  summary: SummaryCounts = {
    activeMembers: 2,
    securityAnalysts: 1,
    operators: 1,
    pendingInvitations: 0,
    activeWithMfa: 1,
    dormantAccounts: 1,
    onboardedThisMonth: 1,
  };
  private sequence = 0;

  async listStaff(query: { q?: string; role?: UserRole; status?: string; mfa?: string }) {
    let rows = this.staff;
    if (query.role !== undefined) rows = rows.filter((row) => row.role === query.role);
    if (query.status !== undefined) {
      rows = rows.filter((row) => row.accountStatus === query.status);
    }
    if (query.mfa === 'enrolled') rows = rows.filter((row) => row.mfaEnrolled);
    if (query.mfa === 'not_enrolled') rows = rows.filter((row) => !row.mfaEnrolled);
    if (query.q !== undefined && query.q !== '') {
      const needle = query.q.toLowerCase();
      rows = rows.filter((row) =>
        `${row.fullName} ${row.email} ${row.scopeSummary ?? ''}`.toLowerCase().includes(needle),
      );
    }
    return { rows, total: rows.length };
  }
  async listPendingInvitations(now: Date) {
    return this.invitations.filter(
      (row) => row.status === 'pending' && new Date(row.expiresAt) > now,
    );
  }
  async getMember(userId: string) {
    return this.staff.find((row) => row.id === userId) ?? null;
  }
  async findByEmail(email: string) {
    return this.staff.find((row) => row.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  async countActiveSuperAdmins(exceptUserId?: string) {
    return this.staff.filter(
      (row) =>
        row.role === 'super_admin' && row.accountStatus === 'active' && row.id !== exceptUserId,
    ).length;
  }
  async findSuperAdminRecipients() {
    return this.staff
      .filter((row) => row.role === 'super_admin' && row.accountStatus === 'active')
      .map((row) => ({
        userId: row.id,
        email: row.email,
        phone: null,
        timezone: 'Africa/Nairobi',
      }));
  }
  async summaryCounts() {
    return this.summary;
  }
  async emailInUse(email: string) {
    return (
      this.staff.some((row) => row.email.toLowerCase() === email.toLowerCase()) ||
      this.invitations.some(
        (row) =>
          row.email.toLowerCase() === email.toLowerCase() &&
          (row.status === 'pending' || row.status === 'draft'),
      )
    );
  }
  async findInvitationByEmail(email: string) {
    return (
      this.invitations.find(
        (row) => row.email.toLowerCase() === email.toLowerCase() && row.status === 'pending',
      ) ?? null
    );
  }
  async findInvitationById(id: string) {
    return this.invitations.find((row) => row.id === id) ?? null;
  }
  async findInvitationByTokenHash(tokenHash: string) {
    return this.invitations.find((row) => row.tokenHash === tokenHash) ?? null;
  }
  async insertInvitation(input: CreateInvitationInput) {
    this.sequence += 1;
    const row: InvitationRow = {
      id: `invite-${this.sequence}`,
      email: input.email,
      fullName: input.fullName,
      jobTitle: input.jobTitle,
      baseLocation: input.baseLocation,
      role: input.role,
      team: input.team,
      accessTier: input.accessTier,
      scopeNotes: input.scopeNotes,
      accessReviewDue: input.accessReviewDue,
      status: input.status,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt.toISOString(),
      resendCount: 0,
      checklist: input.checklist,
    };
    this.invitations.push(row);
    return row;
  }
  async updateInvitation(id: string, patch: Record<string, unknown>) {
    const row = this.invitations.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`invitation not found: ${id}`);
    Object.assign(row, patch, {
      expiresAt:
        patch.expiresAt instanceof Date
          ? patch.expiresAt.toISOString()
          : ((patch.expiresAt as string | undefined) ?? row.expiresAt),
    });
    return row;
  }
  async createProfile(input: CreateProfileInput) {
    this.profiles.push(input);
    this.staff.push(
      staffRow(input.userId, {
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        team: input.team,
        accountStatus: 'active',
        mfaEnrolled: false,
        mfaMethods: [],
        joinedAt: input.joinedAt.toISOString(),
      }),
    );
  }
  async updateMember(userId: string, patch: Record<string, unknown>) {
    const row = this.staff.find((candidate) => candidate.id === userId);
    if (row === undefined) return;
    if (patch.role !== undefined) row.role = patch.role as UserRole;
    if (patch.accountStatus !== undefined) row.accountStatus = patch.accountStatus as string;
    if (patch.suspendedAt !== undefined) {
      row.suspendedAt =
        patch.suspendedAt === null ? null : (patch.suspendedAt as Date).toISOString();
    }
    if (patch.require2fa !== undefined) row.require2fa = patch.require2fa as boolean;
    if (patch.deletedAt !== undefined) row.deletedAt = (patch.deletedAt as Date).toISOString();
  }
  async listSessionIds(userId: string) {
    return this.sessions[userId] ?? [];
  }
  async revokeSessions(sessionIds: string[], at: Date) {
    this.revokedSessions.push(...sessionIds);
    for (const userId of Object.keys(this.sessions)) {
      this.sessions[userId] = (this.sessions[userId] ?? []).filter(
        (id) => !sessionIds.includes(id),
      );
    }
    void at;
    return sessionIds.length;
  }
  async recordSession(input: RecordSessionInput) {
    this.recordedSessions.push(input);
  }
}

function fakeSupabase() {
  const created: Array<{ email: string; emailConfirm?: boolean }> = [];
  const deleted: string[] = [];
  return {
    created,
    deleted,
    supabase: {
      createUser: async (input: { email: string; emailConfirm?: boolean }) => {
        created.push(input);
        return { id: 'b1000000-0000-4000-8000-0000000000ff' };
      },
      signInWithPassword: async () => ({
        session: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          sessionId: 'new-session-id',
          userId: 'b1000000-0000-4000-8000-0000000000ff',
          aal: 'aal1' as const,
          mfaMethod: null,
        },
        userId: 'b1000000-0000-4000-8000-0000000000ff',
        mfaRequired: false,
        factors: [],
      }),
      refresh: async () => {
        throw new Error('unused');
      },
      signOut: async () => undefined,
      updatePassword: async () => undefined,
      deleteSession: async (sessionId: string) => {
        deleted.push(sessionId);
      },
      mfa: {
        enrollTotp: async () => ({ factorId: 'f', qrSvg: '', secret: '', uri: '' }),
        challengeAndVerify: async () => {
          throw new Error('unused');
        },
        unenroll: async () => undefined,
        listFactors: async () => [],
      },
    },
  };
}

interface Harness {
  service: UsersService;
  repo: FakeUsersRepo;
  emails: Array<{ to: string; subject: string; text?: string }>;
  created: Array<{ email: string; emailConfirm?: boolean }>;
  deleted: string[];
  invalidated: string[];
}

function makeService(options: { breach?: boolean; admins?: number } = {}): Harness {
  const repo = new FakeUsersRepo();
  if (options.admins !== undefined) {
    repo.staff = repo.staff.filter((row) => row.role !== 'super_admin');
    for (let index = 0; index < options.admins; index += 1) {
      repo.staff.push(
        staffRow(`b1000000-0000-4000-8000-0000000000a${index}`, {
          email: `admin${index}@vunvault.com`,
        }),
      );
    }
  }
  const emails: Array<{ to: string; subject: string; text?: string }> = [];
  const invalidated: string[] = [];
  const { supabase, created, deleted } = fakeSupabase();

  const service = new UsersService({
    repo,
    supabase: supabase as never,
    email: {
      send: async (message: { to: string; subject: string; text?: string }) => {
        emails.push(message);
        return { id: 'email-1' };
      },
    },
    breach: { isBreached: async () => options.breach === true },
    webOrigin: 'https://www.vunvault.test',
    invalidate: async (sessionId) => {
      invalidated.push(sessionId);
    },
    now: () => NOW,
    randomToken: () => TOKEN,
  });
  return { service, repo, emails, created, deleted, invalidated };
}

const INVITE_BODY: ProvisionInviteBody = {
  fullName: 'Grace Wanjiku',
  email: 'g.wanjiku@vunvault.com',
  role: 'security_analyst',
  team: 'threat_intelligence' as Team,
  accessTier: 'elevated',
  checklist: {
    mfaEnrolmentMandatory: true,
    ndaOnFile: true,
    backgroundVerified: true,
    trainingAcknowledged: true,
  },
};

// ------------------------------------------------------------------ initials

describe('initials', () => {
  it('strips a title before taking the first and last letters', () => {
    expect(initials('Evelyn Reed')).toBe('ER');
    expect(initials('Dr. Evelyn Reed')).toBe('ER');
    expect(initials('Dr Evelyn Reed')).toBe('ER');
    expect(initials('Prof. Amina Yusuf Otieno')).toBe('AO');
    expect(initials('Eng. Samuel Otieno')).toBe('SO');
    expect(initials('Wanjiru')).toBe('WA');
    expect(initials('')).toBe('');
  });
});

// -------------------------------------------------------------- permissions

describe('permission grants', () => {
  it('gives users:manage only to super_admin, so an admin cannot suspend anyone', () => {
    expect(ROLE_PERMISSIONS.super_admin).toContain('users:manage');
    expect(ROLE_PERMISSIONS.admin).not.toContain('users:manage');
    expect(ROLE_PERMISSIONS.admin).toContain('users:read');
    // The route guard is [authenticate, requireStaff, requirePermission('users:manage')],
    // so an `admin` calling POST /admin/users/:id/suspend is refused with 403.
    expect(ROLE_PERMISSIONS.security_analyst).not.toContain('users:manage');
  });
});

// ------------------------------------------------------------------- roster

describe('roster', () => {
  it('lists staff only, computes initials and filters by role and MFA', async () => {
    const { service, repo } = makeService();
    const all = await service.roster({ page: 1, pageSize: 20 });
    expect(all.total).toBe(3);
    expect(all.data.map((row) => row.initials)).toEqual(['ER', 'SO', 'AY']);
    expect(all.data[0]?.accountStatus).toBe('active');

    const analysts = await service.roster({ page: 1, pageSize: 20, role: 'security_analyst' });
    expect(analysts.data.map((row) => row.email)).toEqual(['s.otieno@vunvault.com']);

    const notEnrolled = await service.roster({ page: 1, pageSize: 20, mfa: 'not_enrolled' });
    expect(notEnrolled.data.map((row) => row.email)).toEqual(['s.otieno@vunvault.com']);

    const search = await service.roster({ page: 1, pageSize: 20, q: 'otieno' });
    expect(search.total).toBe(1);
    expect(repo.staff).toHaveLength(3);
  });

  it('includes a pending invitation as a pending_invite row', async () => {
    const { service, repo } = makeService();
    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    const roster = await service.roster({ page: 1, pageSize: 20 });
    expect(roster.total).toBe(4);
    const invited = roster.data.find((row) => row.email === INVITE_BODY.email);
    expect(invited?.accountStatus).toBe('pending_invite');
    expect(invited?.mfa).toEqual({ enrolled: false, methods: [] });
    // Its joinedAt is the issue time: 72 h before the expiry.
    expect(invited?.joinedAt).toBe('2026-09-24T12:00:00.000Z');
    expect(repo.invitations).toHaveLength(1);

    const onlyInvites = await service.roster({ page: 1, pageSize: 20, status: 'pending_invite' });
    expect(onlyInvites.data.map((row) => row.email)).toEqual([INVITE_BODY.email]);
  });
});

describe('summary', () => {
  it('computes every number from the fixtures', async () => {
    const { service } = makeService();
    expect(await service.summary()).toEqual({
      activeMembers: 2,
      securityAnalysts: 1,
      operators: 1,
      pendingInvitations: 0,
      mfaEnrolmentPercent: 50,
      accountsWithoutMfa: 1,
      dormantAccounts: 1,
      onboardedThisMonth: 1,
    });
  });

  it('reports zero percent rather than dividing by zero', async () => {
    const { service, repo } = makeService();
    repo.summary = { ...repo.summary, activeMembers: 0, activeWithMfa: 0 };
    const summary = await service.summary();
    expect(summary.mfaEnrolmentPercent).toBe(0);
    expect(summary.accountsWithoutMfa).toBe(0);
  });

  it('rounds the enrolment percentage', async () => {
    const { service, repo } = makeService();
    repo.summary = { ...repo.summary, activeMembers: 3, activeWithMfa: 1 };
    expect((await service.summary()).mfaEnrolmentPercent).toBe(33);
  });
});

// ------------------------------------------------------------- invitations

describe('invitations', () => {
  it('rejects an address outside the staff domain', async () => {
    const { service, repo, emails } = makeService();
    const error = await service
      .createInvitation(SUPER_ADMIN, { ...INVITE_BODY, email: 'grace@gmail.com' })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).code).toBe('validation_failed');
    expect(repo.invitations).toHaveLength(0);
    expect(emails).toHaveLength(0);
  });

  it('stores the token hash and puts the raw token only in the email', async () => {
    const { service, repo, emails } = makeService();
    const result = await service.createInvitation(SUPER_ADMIN, INVITE_BODY);

    expect(result.token).toBe(TOKEN);
    expect(result.invitation.status).toBe('pending');
    expect(result.invitation.expiresAt).toBe('2026-09-27T12:00:00.000Z');

    const stored = repo.invitations[0];
    expect(stored?.tokenHash).toBe(hashInvitationToken(TOKEN));
    expect(stored?.tokenHash).not.toBe(TOKEN);
    // The raw token appears nowhere in the stored row.
    expect(JSON.stringify(stored)).not.toContain(TOKEN);
    // …and nowhere in the API response either.
    expect(JSON.stringify(result.invitation)).not.toContain(TOKEN);

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: INVITE_BODY.email,
      subject: "You've been invited to VUNVAULT",
    });
    expect(emails[0]?.text).toContain(`token=${TOKEN}`);
    expect(emails[0]?.text).toContain('https://www.vunvault.test/accept-invite?token=');
    expect(emails[0]?.text).toContain('expires in 72 hours');
    expect(emails[0]?.text).toContain('MFA enrolment is mandatory');
  });

  it('stores a draft without sending anything', async () => {
    const { service, repo, emails } = makeService();
    const result = await service.createInvitation(SUPER_ADMIN, { ...INVITE_BODY, draft: true });
    expect(result.token).toBeNull();
    expect(result.invitation.status).toBe('draft');
    expect(repo.invitations[0]?.tokenHash).toBeNull();
    expect(emails).toHaveLength(0);
  });

  it('refuses an address that already has an account or invitation', async () => {
    const { service } = makeService();
    const taken = await service
      .createInvitation(SUPER_ADMIN, { ...INVITE_BODY, email: 'e.reed@vunvault.com' })
      .catch((caught: unknown) => caught);
    expect((taken as HttpError).status).toBe(409);
    expect((taken as HttpError).code).toBe('email_taken');

    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    const duplicate = await service
      .createInvitation(SUPER_ADMIN, INVITE_BODY)
      .catch((caught: unknown) => caught);
    expect((duplicate as HttpError).code).toBe('email_taken');
  });

  it('refuses to let a non-super-admin invite an administrator', async () => {
    const { service } = makeService();
    const actor = { id: OTHER_ADMIN_ID, email: 'a@vunvault.com', role: 'admin' as UserRole };
    const error = await service
      .createInvitation(actor, { ...INVITE_BODY, role: 'super_admin' })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('forbidden');

    // A super administrator may.
    const { service: elevated } = makeService();
    const ok = await elevated.createInvitation(SUPER_ADMIN, {
      ...INVITE_BODY,
      email: 'new.admin@vunvault.com',
      role: 'super_admin',
    });
    expect(ok.invitation.role).toBe('super_admin');
  });

  it('requires the mandatory-MFA checklist item', async () => {
    const { service } = makeService();
    const error = await service
      .createInvitation(SUPER_ADMIN, {
        ...INVITE_BODY,
        checklist: { ...INVITE_BODY.checklist, mfaEnrolmentMandatory: false } as never,
      })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).code).toBe('validation_failed');
  });

  it('resends with a rotated token up to five times, then refuses', async () => {
    const { service, repo, emails } = makeService();
    const { invitation } = await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    expect(MAX_RESENDS).toBe(5);

    let token = 1;
    for (let index = 0; index < MAX_RESENDS; index += 1) {
      token += 1;
      const next = `b${token}`.padEnd(43, '0');
      (service as unknown as { randomToken: () => string }).randomToken = () => next;
      const resent = await service.resendInvitation(invitation.id);
      expect(resent.invitation.resendCount).toBe(index + 1);
      expect(resent.token).toBe(next);
      expect(repo.invitations[0]?.tokenHash).toBe(hashInvitationToken(next));
      expect(repo.invitations[0]?.expiresAt).toBe('2026-09-27T12:00:00.000Z');
    }
    // One email per issue plus one per resend.
    expect(emails).toHaveLength(6);

    const limit = await service.resendInvitation(invitation.id).catch((caught: unknown) => caught);
    expect((limit as HttpError).status).toBe(409);
    expect((limit as HttpError).code).toBe('resend_limit');
    expect(emails).toHaveLength(6);
  });

  it('revokes an invitation and refuses to revoke an accepted one', async () => {
    const { service, repo } = makeService();
    const { invitation } = await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    await service.revokeInvitation(invitation.id);
    expect(repo.invitations[0]?.status).toBe('revoked');
    expect(repo.invitations[0]?.tokenHash).toBeNull();

    repo.invitations[0] = { ...(repo.invitations[0] as InvitationRow), status: 'accepted' };
    const error = await service.revokeInvitation(invitation.id).catch((caught: unknown) => caught);
    expect((error as HttpError).code).toBe('invalid_state');
  });
});

// ------------------------------------------------------- preview and accept

describe('invitation preview', () => {
  it('shows the role and team labels for a live invitation', async () => {
    const { service } = makeService();
    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    expect(await service.preview(TOKEN)).toEqual({
      email: INVITE_BODY.email,
      fullName: INVITE_BODY.fullName,
      role: 'security_analyst',
      roleLabel: 'Security Analyst',
      team: 'threat_intelligence',
      teamLabel: 'Threat Intelligence',
      expiresAt: '2026-09-27T12:00:00.000Z',
    });
  });

  it('answers an identical 404 for unknown, expired and used tokens', async () => {
    const { service, repo } = makeService();
    const unknown = await service.preview(TOKEN).catch((caught: unknown) => caught);
    expect((unknown as HttpError).status).toBe(404);
    expect((unknown as HttpError).code).toBe('not_found');
    expect(unknown).toEqual(await service.preview('nope').catch((caught: unknown) => caught));

    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    // Expired.
    repo.invitations[0] = {
      ...(repo.invitations[0] as InvitationRow),
      expiresAt: new Date(NOW.getTime() - 1000).toISOString(),
    };
    const expired = await service.preview(TOKEN).catch((caught: unknown) => caught);
    expect(expired).toEqual(unknown);

    // Accepted (reused).
    repo.invitations[0] = {
      ...(repo.invitations[0] as InvitationRow),
      status: 'accepted',
      expiresAt: '2026-09-27T12:00:00.000Z',
    };
    const reused = await service.preview(TOKEN).catch((caught: unknown) => caught);
    expect(reused).toEqual(unknown);
    expect(JSON.stringify(reused)).toBe(JSON.stringify(expired));
  });
});

describe('invitation acceptance', () => {
  const PASSWORD = 'Start-Here-2026!';

  it('creates a confirmed user, an active profile and an aal1 session', async () => {
    const { service, repo, created } = makeService();
    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);

    const result = await service.accept(
      TOKEN,
      { password: PASSWORD, confirmPassword: PASSWORD },
      {
        ip: '41.90.0.7',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      },
    );

    expect(created).toEqual([
      {
        email: INVITE_BODY.email,
        password: PASSWORD,
        emailConfirm: true,
        userMetadata: expect.any(Object),
      },
    ] as never);
    expect(result.mfaEnrolmentRequired).toBe(true);
    expect(result.user).toMatchObject({
      email: INVITE_BODY.email,
      fullName: INVITE_BODY.fullName,
      role: 'security_analyst',
      orgId: null,
      mfaEnrolled: false,
    });
    expect(result.user.permissions.length).toBeGreaterThan(0);
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });
    expect(result.sessionId).toBe('new-session-id');

    // The profile is active, unenrolled and due for an access review.
    expect(repo.profiles[0]).toMatchObject({
      email: INVITE_BODY.email,
      role: 'security_analyst',
      team: 'threat_intelligence',
      accessTier: 'elevated',
    });
    expect(repo.profiles[0]?.joinedAt).toEqual(NOW);
    expect(repo.invitations[0]?.status).toBe('accepted');
    expect(repo.invitations[0]?.tokenHash).toBeNull();

    // The session row is aal1: no MFA method, so /admin/* stays closed.
    expect(repo.recordedSessions[0]).toMatchObject({
      sessionId: 'new-session-id',
      mfaMethod: null,
      deviceLabel: expect.stringContaining('Mac'),
    });
  });

  it('refuses a short or breached password without creating anything', async () => {
    const { service, repo, created } = makeService();
    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);

    const tooShort = await service
      .accept(
        TOKEN,
        { password: 'Short1!', confirmPassword: 'Short1!' },
        { ip: '1.1.1.1', userAgent: null },
      )
      .catch((caught: unknown) => caught);
    expect((tooShort as HttpError).code).toBe('validation_failed');

    const mismatch = await service
      .accept(
        TOKEN,
        { password: PASSWORD, confirmPassword: 'Different-2026!!' },
        { ip: '1.1.1.1', userAgent: null },
      )
      .catch((caught: unknown) => caught);
    expect((mismatch as HttpError).details).toEqual([
      { path: ['confirmPassword'], message: 'The passwords do not match' },
    ]);
    expect(created).toHaveLength(0);
    expect(repo.profiles).toHaveLength(0);

    const { service: breachedService, repo: breachedRepo } = makeService({ breach: true });
    await breachedService.createInvitation(SUPER_ADMIN, INVITE_BODY);
    const breached = await breachedService
      .accept(
        TOKEN,
        { password: PASSWORD, confirmPassword: PASSWORD },
        { ip: '1.1.1.1', userAgent: null },
      )
      .catch((caught: unknown) => caught);
    expect((breached as HttpError).status).toBe(422);
    expect((breached as HttpError).code).toBe('breached_password');
    expect(breachedRepo.profiles).toHaveLength(0);
    // The invitation is still usable after a failed attempt.
    expect(breachedRepo.invitations[0]?.status).toBe('pending');
  });

  it('cannot be replayed: the token is spent', async () => {
    const { service } = makeService();
    await service.createInvitation(SUPER_ADMIN, INVITE_BODY);
    await service.accept(
      TOKEN,
      { password: PASSWORD, confirmPassword: PASSWORD },
      { ip: '1.1.1.1', userAgent: null },
    );

    const replay = await service
      .accept(
        TOKEN,
        { password: PASSWORD, confirmPassword: PASSWORD },
        { ip: '1.1.1.1', userAgent: null },
      )
      .catch((caught: unknown) => caught);
    expect((replay as HttpError).status).toBe(404);
  });
});

// ---------------------------------------------------------- account actions

describe('account actions', () => {
  it('suspends a colleague and revokes every one of their sessions', async () => {
    const { service, repo, deleted, invalidated } = makeService();
    const member = await service.suspend(SUPER_ADMIN, OTHER_ADMIN_ID, 'Left the engagement');
    expect(member.accountStatus).toBe('suspended');
    expect(member.suspendedAt).toBe(NOW.toISOString());
    expect(repo.revokedSessions).toEqual(['sess-1', 'sess-2']);
    expect(deleted).toEqual(['sess-1', 'sess-2']);
    expect(invalidated).toEqual(['sess-1', 'sess-2']);
    expect(repo.sessions[OTHER_ADMIN_ID]).toEqual([]);
  });

  it('refuses self-suspension, self-role-change and self-deletion', async () => {
    const { service, repo } = makeService({ admins: 2 });
    const admins = repo.staff.filter((row) => row.role === 'super_admin');
    const self = {
      id: (admins[0] as StaffRow).id,
      email: (admins[0] as StaffRow).email,
      role: 'super_admin' as UserRole,
    };

    for (const attempt of [
      () => service.suspend(self, self.id),
      () => service.changeRole(self, self.id, 'security_analyst'),
      () => service.softDelete(self, self.id),
    ]) {
      const error = await attempt().catch((caught: unknown) => caught);
      expect((error as HttpError).status).toBe(409);
      expect((error as HttpError).code).toBe('self_action');
    }
  });

  it('protects the last active super administrator', async () => {
    const { service, repo } = makeService({ admins: 2 });
    // One super administrator is dormant, so the other is the last *active* one.
    const admins = repo.staff.filter((row) => row.role === 'super_admin');
    const [actorRow, only] = admins as [StaffRow, StaffRow];
    actorRow.accountStatus = 'dormant';
    const actor = { id: actorRow.id, email: actorRow.email, role: 'super_admin' as UserRole };

    const suspend = await service.suspend(actor, only.id).catch((caught: unknown) => caught);
    expect((suspend as HttpError).status).toBe(409);
    expect((suspend as HttpError).code).toBe('last_super_admin');

    const demote = await service
      .changeRole(actor, only.id, 'security_analyst')
      .catch((caught: unknown) => caught);
    expect((demote as HttpError).code).toBe('last_super_admin');

    const remove = await service.softDelete(actor, only.id).catch((caught: unknown) => caught);
    expect((remove as HttpError).code).toBe('last_super_admin');

    expect(only.accountStatus).toBe('active');
    expect(only.role).toBe('super_admin');
  });

  it('allows a demotion while another super administrator remains', async () => {
    const { service, repo } = makeService({ admins: 2 });
    const admins = repo.staff.filter((row) => row.role === 'super_admin');
    const [first, second] = admins as [StaffRow, StaffRow];
    const actor = { id: first.id, email: first.email, role: 'super_admin' as UserRole };
    repo.sessions[second.id] = ['sess-1', 'sess-2'];

    const changed = await service.changeRole(actor, second.id, 'security_analyst');
    expect(changed.previousRole).toBe('super_admin');
    expect(changed.member.role).toBe('security_analyst');
    // Sessions are revoked so the next token carries the reduced claims.
    expect(repo.revokedSessions).toEqual(['sess-1', 'sess-2']);
  });

  it('reactivates only from suspended or dormant', async () => {
    const { service, repo } = makeService();
    await service.suspend(SUPER_ADMIN, OTHER_ADMIN_ID);
    const reactivated = await service.reactivate(SUPER_ADMIN, OTHER_ADMIN_ID);
    expect(reactivated.accountStatus).toBe('active');
    expect(reactivated.suspendedAt).toBeNull();
    expect(repo.staff[1]?.suspendedAt).toBeNull();

    const invalid = await service
      .reactivate(SUPER_ADMIN, OTHER_ADMIN_ID)
      .catch((caught: unknown) => caught);
    expect((invalid as HttpError).code).toBe('invalid_state');

    const dormant = await service.reactivate(SUPER_ADMIN, ANALYST_ID);
    expect(dormant.accountStatus).toBe('active');
  });

  it('enforces MFA only on an account that has not enrolled', async () => {
    const { service, repo, emails } = makeService();
    const enforced = await service.enforceMfa(SUPER_ADMIN, OTHER_ADMIN_ID);
    expect(enforced.email).toBe('s.otieno@vunvault.com');
    expect(repo.staff[1]?.require2fa).toBe(true);
    expect(emails.at(-1)?.subject).toBe('Multi-factor authentication is now required');
    expect(emails.at(-1)?.text).toContain('mandatory');

    const already = await service
      .enforceMfa(SUPER_ADMIN, ADMIN_ID)
      .catch((caught: unknown) => caught);
    expect((already as HttpError).status).toBe(409);
    expect((already as HttpError).code).toBe('invalid_state');
  });

  it('soft-deletes a colleague and revokes their sessions', async () => {
    const { service, repo, deleted } = makeService({ admins: 2 });
    const admins = repo.staff.filter((row) => row.role === 'super_admin');
    const [first, target] = admins as [StaffRow, StaffRow];
    const actor = { id: first.id, email: first.email, role: 'super_admin' as UserRole };
    repo.sessions[target.id] = ['sess-a', 'sess-b'];

    await service.softDelete(actor, target.id, 'Contract ended');
    const stored = repo.staff.find((row) => row.id === target.id);
    expect(stored?.deletedAt).toBe(NOW.toISOString());
    expect(stored?.accountStatus).toBe('suspended');
    expect(deleted).toEqual(['sess-a', 'sess-b']);
  });

  it('answers 404 for an account that does not exist', async () => {
    const { service } = makeService();
    const error = await service
      .suspend(SUPER_ADMIN, 'b1000000-0000-4000-8000-0000000000ff')
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(404);
  });
});
