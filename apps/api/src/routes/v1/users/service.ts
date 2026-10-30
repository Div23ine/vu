import {
  ROLE_LABELS,
  TEAM_LABELS,
  ROLE_PERMISSIONS,
  type InvitationPreview,
  type MfaMethod,
  type SessionUser,
  type StaffMember,
  type StaffSummary,
  type Team,
  type UserRole,
} from '@vunvault/contracts';
import type { Invitation, ProvisionInviteBody } from '@vunvault/contracts';
import { randomBytes } from 'node:crypto';
import { HttpError } from '../../../lib/http-error.js';
import { populatedRosterSlots } from '../../../lib/admin-roster.js';
import type { BreachCheck } from '../../../lib/breach.js';
import type { EmailProvider } from '../../../providers/email.js';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import type { NotificationDispatcher } from '../../../lib/notify.js';
import { validatePassword } from '../account-security/password-policy.js';
import { deviceLabel } from '../auth/device.js';
import {
  INVITATION_TTL_MS,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  isExpired,
} from './tokens.js';
import type { InvitationRow, StaffRow, UsersRepo } from './repo.js';

/**
 * User & Access Management.
 *
 * Two invariants run through every method here:
 *
 * 1. The last active super administrator can never be suspended, demoted or
 *    deleted — the platform must always retain someone who can administer it.
 * 2. No actor can act on their own account. An administrator who needs their own
 *    access changed asks a colleague; that is the point of the rule.
 */

export const STAFF_EMAIL_DOMAIN = '@vunvault.com';
/** Five resends is the ceiling: after that an invitation is revoked and reissued. */
export const MAX_RESENDS = 5;
const TITLES = new Set([
  'dr',
  'dr.',
  'prof',
  'prof.',
  'mr',
  'mr.',
  'mrs',
  'mrs.',
  'ms',
  'ms.',
  'eng',
  'eng.',
]);

/** `"Dr. Evelyn Reed"` → `"ER"`; the title is stripped before the letters are taken. */
export function initials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '' && !TITLES.has(part.toLowerCase()));
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  const first = (parts[0] as string).charAt(0);
  const last = (parts[parts.length - 1] as string).charAt(0);
  return `${first}${last}`.toUpperCase();
}

export interface ActorContext {
  id: string;
  email: string;
  role: UserRole;
}

export interface UsersServiceDeps {
  repo: UsersRepo;
  supabase: SupabaseAdmin;
  email?: EmailProvider;
  notify?: NotificationDispatcher;
  breach?: BreachCheck;
  webOrigin: string;
  /** Drops `sess:<id>` from Redis so a revoked session stops working immediately. */
  invalidate?: (sessionId: string) => Promise<void>;
  now?: () => Date;
  /** Test seam: a deterministic invitation token. */
  randomToken?: () => string;
}

/** What one `provisionAdminRoster` pass did (the script audits `created`). */
export interface ProvisionRosterSummary {
  created: Array<{ userId: string; email: string; role: UserRole }>;
  roleCorrected: Array<{ userId: string; email: string; role: UserRole }>;
  skipped: string[];
}

export interface RosterFilters {
  q?: string;
  role?: UserRole;
  status?: string;
  mfa?: 'enrolled' | 'not_enrolled';
  page: number;
  pageSize: number;
}

export interface InvitationResult {
  invitation: Invitation;
  /** Present exactly once — it only ever leaves the process inside an email. */
  token: string | null;
}

export interface AcceptResult {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  sessionId: string;
  mfaEnrolmentRequired: true;
}

export class UsersService {
  private readonly repo: UsersRepo;
  private readonly supabase: SupabaseAdmin;
  private readonly email: EmailProvider | undefined;
  private readonly notify: NotificationDispatcher | undefined;
  private readonly breach: BreachCheck | undefined;
  private readonly webOrigin: string;
  private readonly invalidate: (sessionId: string) => Promise<void>;
  private readonly now: () => Date;
  private readonly randomToken: () => string;

  constructor(deps: UsersServiceDeps) {
    this.repo = deps.repo;
    this.supabase = deps.supabase;
    this.email = deps.email;
    this.notify = deps.notify;
    this.breach = deps.breach;
    this.webOrigin = deps.webOrigin.replace(/\/$/, '');
    this.invalidate = deps.invalidate ?? (async () => undefined);
    this.now = deps.now ?? (() => new Date());
    this.randomToken = deps.randomToken ?? generateInvitationToken;
  }

  // ------------------------------------------------------------------ roster

  async roster(query: RosterFilters): Promise<{ data: StaffMember[]; total: number }> {
    const now = this.now();
    const wantsInvitations = query.status === undefined || query.status === 'pending_invite';
    const wantsProfiles = query.status === undefined || query.status !== 'pending_invite';

    const [staff, invitations] = await Promise.all([
      wantsProfiles ? this.repo.listStaff(query) : Promise.resolve({ rows: [], total: 0 }),
      wantsInvitations ? this.repo.listPendingInvitations(now) : Promise.resolve([]),
    ]);

    const invitedEmails = new Set(staff.rows.map((row) => row.email.toLowerCase()));
    const invitationRows = invitations
      .filter((invitation) => !invitedEmails.has(invitation.email.toLowerCase()))
      .filter((invitation) => matchesFilters(invitation, query))
      .map((invitation) => toStaffMemberFromInvitation(invitation));

    const rows = [...staff.rows.map(toStaffMember), ...invitationRows];
    return { data: rows, total: staff.total + invitationRows.length };
  }

  async summary(): Promise<StaffSummary> {
    const counts = await this.repo.summaryCounts(this.now());
    const percent =
      counts.activeMembers === 0
        ? 0
        : Math.round((100 * counts.activeWithMfa) / counts.activeMembers);
    return {
      activeMembers: counts.activeMembers,
      securityAnalysts: counts.securityAnalysts,
      operators: counts.operators,
      pendingInvitations: counts.pendingInvitations,
      mfaEnrolmentPercent: percent,
      accountsWithoutMfa: Math.max(0, counts.activeMembers - counts.activeWithMfa),
      dormantAccounts: counts.dormantAccounts,
      onboardedThisMonth: counts.onboardedThisMonth,
    };
  }

  // ------------------------------------------------------------- invitations

  async createInvitation(
    actor: ActorContext,
    body: ProvisionInviteBody,
  ): Promise<InvitationResult> {
    const email = body.email.trim().toLowerCase();
    if (!email.endsWith(STAFF_EMAIL_DOMAIN)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['email'], message: 'Staff invitations require a @vunvault.com address' },
      ]);
    }
    // `ProvisionInviteBody.role` is a StaffRoleSchema, so a client role cannot be
    // named here at all — the schema is the guard.
    // Only a super administrator may create another administrator.
    if ((body.role === 'admin' || body.role === 'super_admin') && actor.role !== 'super_admin') {
      throw new HttpError(403, 'forbidden', 'Only a super administrator may invite administrators');
    }
    if (!body.checklist.mfaEnrolmentMandatory) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['checklist', 'mfaEnrolmentMandatory'], message: 'MFA enrolment is mandatory' },
      ]);
    }
    if (await this.repo.emailInUse(email)) {
      throw new HttpError(409, 'email_taken', 'That address already has an account or invitation');
    }

    const draft = body.draft === true;
    const token = draft ? null : this.randomToken();
    const invitation = await this.repo.insertInvitation({
      email,
      fullName: body.fullName,
      jobTitle: body.jobTitle ?? null,
      baseLocation: body.baseLocation ?? null,
      role: body.role,
      team: body.team as Team,
      accessTier: body.accessTier,
      scopeNotes: body.scopeNotes ?? null,
      accessReviewDue: body.accessReviewDue ?? null,
      checklist: { ...body.checklist },
      status: draft ? 'draft' : 'pending',
      tokenHash: token === null ? null : hashInvitationToken(token),
      expiresAt: invitationExpiry(this.now()),
      invitedBy: actor.id,
    });

    if (!draft && token !== null) {
      await this.sendInvitationEmail(invitation, token);
      await this.notifyTeamProvisioned(invitation);
    }
    return { invitation: toInvitation(invitation), token };
  }

  async resendInvitation(id: string): Promise<InvitationResult> {
    const invitation = await this.repo.findInvitationById(id);
    if (invitation === null) throw HttpError.notFound();
    if (invitation.status !== 'pending') {
      throw new HttpError(409, 'invalid_state', 'Only a pending invitation can be resent');
    }
    if (invitation.resendCount >= MAX_RESENDS) {
      throw new HttpError(409, 'resend_limit', 'That invitation has been resent five times');
    }

    // A resend rotates the token: the previous link stops working the moment the
    // new one is issued.
    const token = this.randomToken();
    const updated = await this.repo.updateInvitation(id, {
      tokenHash: hashInvitationToken(token),
      expiresAt: invitationExpiry(this.now()),
      resendCount: invitation.resendCount + 1,
    });
    await this.sendInvitationEmail(updated, token);
    return { invitation: toInvitation(updated), token };
  }

  async revokeInvitation(id: string): Promise<void> {
    const invitation = await this.repo.findInvitationById(id);
    if (invitation === null) throw HttpError.notFound();
    if (invitation.status === 'accepted') {
      throw new HttpError(409, 'invalid_state', 'An accepted invitation cannot be revoked');
    }
    await this.repo.updateInvitation(id, { status: 'revoked', tokenHash: null });
  }

  /**
   * Unknown, expired, revoked and already-accepted tokens all answer the same 404:
   * this endpoint must not become a way to enumerate live invitations.
   */
  async preview(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.findUsableInvitation(rawToken);
    return {
      email: invitation.email,
      fullName: invitation.fullName,
      role: invitation.role,
      roleLabel: ROLE_LABELS[invitation.role],
      team: invitation.team,
      teamLabel: TEAM_LABELS[invitation.team],
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(
    rawToken: string,
    body: { password: string; confirmPassword: string },
    meta: { ip: string; userAgent: string | null },
  ): Promise<AcceptResult> {
    const invitation = await this.findUsableInvitation(rawToken);

    const policy = validatePassword(body.password, invitation.role);
    if (!policy.valid) {
      throw HttpError.badRequest(
        'validation_failed',
        policy.issues.map((issue) => ({
          path: ['password', issue.rule],
          message: issue.message,
        })),
      );
    }
    if (body.password !== body.confirmPassword) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['confirmPassword'], message: 'The passwords do not match' },
      ]);
    }
    if (this.breach !== undefined && (await this.breach.isBreached(body.password))) {
      throw new HttpError(422, 'breached_password', 'That password appears in a known breach');
    }

    const now = this.now();
    // The invitation email proves mailbox ownership, so the user is created
    // already confirmed — there is no verification round trip to wait for.
    const created = await this.supabase.createUser({
      email: invitation.email,
      password: body.password,
      emailConfirm: true,
      userMetadata: {
        full_name: invitation.fullName,
        role: invitation.role,
        team: invitation.team,
      },
    });

    await this.repo.createProfile({
      userId: created.id,
      email: invitation.email,
      fullName: invitation.fullName,
      jobTitle: invitation.jobTitle,
      baseLocation: invitation.baseLocation,
      role: invitation.role,
      team: invitation.team,
      accessTier: invitation.accessTier,
      scopeNotes: invitation.scopeNotes,
      accessReviewDue: invitation.accessReviewDue,
      joinedAt: now,
    });
    await this.repo.updateInvitation(invitation.id, { status: 'accepted', tokenHash: null });

    // Signing in immediately means the new colleague lands in the product at aal1:
    // every /admin/* route answers `mfa_required` until they enrol a factor.
    const signed = await this.supabase.signInWithPassword(invitation.email, body.password);
    const session = signed.session as SupabaseSession | null;
    if (session === null) {
      throw new HttpError(502, 'upstream_error', 'The identity provider did not return a session');
    }
    const sessionId = session.sessionId ?? created.id;
    await this.repo.recordSession({
      sessionId,
      userId: created.id,
      deviceLabel: deviceLabel(meta.userAgent),
      userAgent: meta.userAgent,
      ip: meta.ip,
      mfaMethod: null,
      startedAt: now,
    });

    return {
      user: {
        id: created.id,
        email: invitation.email,
        fullName: invitation.fullName,
        role: invitation.role,
        orgId: null,
        permissions: [...ROLE_PERMISSIONS[invitation.role]],
        mfaEnrolled: false,
      },
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
      sessionId,
      mfaEnrolmentRequired: true,
    };
  }

  private async findUsableInvitation(rawToken: string): Promise<InvitationRow> {
    const invitation = await this.repo.findInvitationByTokenHash(hashInvitationToken(rawToken));
    if (invitation === null || invitation.status !== 'pending') throw HttpError.notFound();
    if (isExpired(invitation.expiresAt, this.now())) throw HttpError.notFound();
    return invitation;
  }

  private async sendInvitationEmail(invitation: InvitationRow, token: string): Promise<void> {
    if (this.email === undefined) return;
    const link = `${this.webOrigin}/accept-invite?token=${token}`;
    await this.email.send({
      to: invitation.email,
      subject: "You've been invited to VUNVAULT",
      text: [
        `${invitation.fullName},`,
        '',
        `You have been invited to join VUNVAULT as ${ROLE_LABELS[invitation.role]} — ${TEAM_LABELS[invitation.team]}.`,
        '',
        `Accept your invitation: ${link}`,
        '',
        'This invitation expires in 72 hours. MFA enrolment is mandatory: you will be asked to register an authenticator or a hardware key before you can reach any administrative area.',
      ].join('\n'),
      html: `<p>${invitation.fullName},</p>
<p>You have been invited to join VUNVAULT as ${ROLE_LABELS[invitation.role]} — ${TEAM_LABELS[invitation.team]}.</p>
<p><a href="${link}">Accept your invitation</a></p>
<p>This invitation expires in 72 hours. MFA enrolment is mandatory.</p>`,
    });
  }

  /** Non-critical: a new colleague is worth knowing about, not worth paging for. */
  private async notifyTeamProvisioned(invitation: InvitationRow): Promise<void> {
    if (this.notify === undefined) return;
    const admins = await this.repo.findSuperAdminRecipients();
    for (const admin of admins) {
      await this.notify.dispatch({
        userId: admin.userId,
        event: 'team_member_provisioned',
        title: 'New team member invited',
        body: `${invitation.email} was invited as ${ROLE_LABELS[invitation.role]}`,
      });
    }
  }

  // ---------------------------------------------------------- account actions

  async suspend(actor: ActorContext, id: string, reason?: string): Promise<StaffMember> {
    const member = await this.requireMember(id);
    this.assertNotSelf(actor, id);
    await this.assertNotLastSuperAdmin(member);

    const now = this.now();
    await this.repo.updateMember(id, {
      accountStatus: 'suspended',
      suspendedAt: now,
      suspendedReason: reason ?? null,
    });
    // Every token is revoked: a suspended account must not keep a live session.
    await this.revokeAllSessions(id);
    return this.memberView(id);
  }

  async reactivate(actor: ActorContext, id: string): Promise<StaffMember> {
    void actor;
    const member = await this.requireMember(id);
    if (member.accountStatus !== 'suspended' && member.accountStatus !== 'dormant') {
      throw new HttpError(
        409,
        'invalid_state',
        'Only a suspended or dormant account can be reactivated',
      );
    }
    await this.repo.updateMember(id, {
      accountStatus: 'active',
      suspendedAt: null,
      suspendedReason: null,
    });
    return this.memberView(id);
  }

  /**
   * Phase 2 unblock path (work order §2): a super admin (`users:manage`)
   * resets an administrator whose first-sign-in MFA setup window expired or
   * was abandoned. The account returns to `active` with `mfa_enrolled` still
   * false, so the NEXT magic-link sign-in opens a fresh 5:00 setup window —
   * the forced-setup gate is never waived, only re-armed. (The setup ledger
   * needs no cleanup here: blocking already deleted the record.)
   */
  /**
   * Phase 2 provisioning: materialise the administrator roster (work order
   * §2 — data-driven from `lib/admin-roster.ts`, names resolved from the
   * contributor records, never invented). IDEMPOTENT: a filled slot whose
   * profile already exists is left alone (its role is corrected if it
   * drifted); placeholders are skipped. New identities get a Supabase user
   * with a random never-used password (the only login credential is the
   * magic link), `email_confirm: true` and an `active` staff profile with
   * `mfa_enrolled = false` — so the first sign-in hits the forced setup
   * window (or, for the exempt super admin, walks straight through).
   */
  async provisionAdminRoster(): Promise<ProvisionRosterSummary> {
    const summary: ProvisionRosterSummary = { created: [], roleCorrected: [], skipped: [] };
    for (const slot of populatedRosterSlots()) {
      if (slot.email === null || slot.fullName === null) continue;
      const existing = await this.repo.findByEmail(slot.email);
      if (existing !== null) {
        if (existing.role !== slot.role) {
          await this.repo.updateMember(existing.id, { role: slot.role });
          summary.roleCorrected.push({ userId: existing.id, email: slot.email, role: slot.role });
        } else {
          summary.skipped.push(slot.email);
        }
        continue;
      }
      // A random password nobody knows: magic links are the only credential.
      const { id } = await this.supabase.createUser({
        email: slot.email,
        password: randomBytes(32).toString('base64url'),
        emailConfirm: true,
        userMetadata: { full_name: slot.fullName, provisioned_by: 'admin-roster' },
      });
      await this.repo.createProfile({
        userId: id,
        email: slot.email,
        fullName: slot.fullName,
        jobTitle: slot.jobTitle,
        baseLocation: null,
        role: slot.role,
        team: null, // org-level administrators: the fixture precedent (super_admin) has no team
        accessTier: slot.role === 'super_admin' ? 'elevated' : 'standard',
        scopeNotes: 'Provisioned from the administrator roster (Phase 2)',
        accessReviewDue: null,
        joinedAt: this.now(),
      });
      summary.created.push({ userId: id, email: slot.email, role: slot.role });
    }
    return summary;
  }

  async unblockMfa(actor: ActorContext, id: string): Promise<StaffMember> {
    void actor;
    const member = await this.requireMember(id);
    if (member.accountStatus !== 'blocked_mfa_setup') {
      throw new HttpError(
        409,
        'invalid_state',
        'Only an account blocked on MFA setup can be unblocked',
      );
    }
    await this.repo.updateMember(id, { accountStatus: 'active' });
    return this.memberView(id);
  }

  async enforceMfa(actor: ActorContext, id: string): Promise<StaffMember> {
    void actor;
    const member = await this.requireMember(id);
    if (member.mfaEnrolled) {
      throw new HttpError(409, 'invalid_state', 'That account has already enrolled MFA');
    }
    await this.repo.updateMember(id, { require2fa: true });
    if (this.email !== undefined) {
      await this.email.send({
        to: member.email,
        subject: 'Multi-factor authentication is now required',
        text: [
          `${member.fullName},`,
          '',
          'An administrator has made multi-factor authentication mandatory on your VUNVAULT account.',
          '',
          'Sign in and register an authenticator app or a hardware key. Until you do, administrative areas stay closed to your session.',
        ].join('\n'),
        html: `<p>${member.fullName},</p>
<p>An administrator has made multi-factor authentication mandatory on your VUNVAULT account.</p>
<p>Sign in and register an authenticator app or a hardware key.</p>`,
      });
    }
    return this.memberView(id);
  }

  async changeRole(
    actor: ActorContext,
    id: string,
    role: UserRole,
  ): Promise<{ member: StaffMember; previousRole: UserRole }> {
    const member = await this.requireMember(id);
    this.assertNotSelf(actor, id);
    if ((member.role === 'super_admin' || role === 'super_admin') && actor.role !== 'super_admin') {
      throw new HttpError(
        403,
        'forbidden',
        'Only a super administrator may change administrator roles',
      );
    }
    if (member.role === 'super_admin' && role !== 'super_admin') {
      // Demoting the last super administrator would leave nobody able to administer.
      const remaining = await this.repo.countActiveSuperAdmins(id);
      if (remaining === 0) {
        throw new HttpError(
          409,
          'last_super_admin',
          'Another super administrator is required first',
        );
      }
    }

    const previousRole = member.role;
    await this.repo.updateMember(id, { role });
    // Sessions are revoked so the next token carries the new claims; an old JWT
    // must not keep the permissions that were just removed.
    await this.revokeAllSessions(id);
    return { member: await this.memberView(id), previousRole };
  }

  async softDelete(actor: ActorContext, id: string, reason?: string): Promise<void> {
    const member = await this.requireMember(id);
    this.assertNotSelf(actor, id);
    await this.assertNotLastSuperAdmin(member);

    const now = this.now();
    // Soft delete: audit entries must keep resolving their actor, so the profile
    // row is never removed.
    await this.repo.updateMember(id, {
      deletedAt: now,
      accountStatus: 'suspended',
      suspendedAt: now,
      suspendedReason: reason ?? null,
    });
    await this.revokeAllSessions(id);
  }

  private assertNotSelf(actor: ActorContext, id: string): void {
    if (actor.id === id) {
      throw new HttpError(
        409,
        'self_action',
        'Ask another administrator to change your own access',
      );
    }
  }

  private async assertNotLastSuperAdmin(member: StaffRow): Promise<void> {
    if (member.role !== 'super_admin' || member.accountStatus !== 'active') return;
    const remaining = await this.repo.countActiveSuperAdmins(member.id);
    if (remaining === 0) {
      throw new HttpError(409, 'last_super_admin', 'Another super administrator is required first');
    }
  }

  private async revokeAllSessions(userId: string): Promise<number> {
    const sessionIds = await this.repo.listSessionIds(userId);
    const revoked = await this.repo.revokeSessions(sessionIds, this.now());
    for (const sessionId of sessionIds) {
      await this.supabase.deleteSession(sessionId).catch(() => undefined);
      await this.invalidate(sessionId).catch(() => undefined);
    }
    return revoked;
  }

  private async requireMember(id: string): Promise<StaffRow> {
    const member = await this.repo.getMember(id);
    if (member === null) throw HttpError.notFound();
    return member;
  }

  private async memberView(id: string): Promise<StaffMember> {
    return toStaffMember(await this.requireMember(id));
  }
}

// -------------------------------------------------------------------- mappers

function toStaffMember(row: StaffRow): StaffMember {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    initials: initials(row.fullName),
    role: row.role,
    team: row.team,
    accountStatus: row.accountStatus as StaffMember['accountStatus'],
    accessTier: row.accessTier as StaffMember['accessTier'],
    baseLocation: row.baseLocation,
    scopeSummary: row.scopeSummary,
    mfa: { enrolled: row.mfaEnrolled, methods: row.mfaMethods as MfaMethod[] },
    joinedAt: row.joinedAt,
    lastActiveAt: row.lastActiveAt,
    suspendedAt: row.suspendedAt,
    accessReviewDue: row.accessReviewDue,
  };
}

/**
 * An invitation with no profile yet still belongs in the roster, as a row marked
 * `pending_invite`. Its `joinedAt` is the issue time, derived from the expiry.
 */
function toStaffMemberFromInvitation(invitation: InvitationRow): StaffMember {
  return {
    id: invitation.id,
    fullName: invitation.fullName,
    email: invitation.email,
    initials: initials(invitation.fullName),
    role: invitation.role,
    team: invitation.team,
    accountStatus: 'pending_invite',
    accessTier: invitation.accessTier as StaffMember['accessTier'],
    baseLocation: invitation.baseLocation,
    scopeSummary: invitation.scopeNotes,
    mfa: { enrolled: false, methods: [] },
    joinedAt: new Date(new Date(invitation.expiresAt).getTime() - INVITATION_TTL_MS).toISOString(),
    lastActiveAt: null,
    suspendedAt: null,
    accessReviewDue: invitation.accessReviewDue,
  };
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    team: row.team,
    status: row.status,
    expiresAt: row.expiresAt,
    resendCount: row.resendCount,
  };
}

function matchesFilters(invitation: InvitationRow, query: RosterFilters): boolean {
  if (query.role !== undefined && invitation.role !== query.role) return false;
  if (query.mfa !== undefined && query.mfa === 'enrolled') return false;
  if (query.q !== undefined && query.q !== '') {
    const needle = query.q.toLowerCase();
    const haystack = `${invitation.fullName} ${invitation.email} ${invitation.scopeNotes ?? ''}`;
    if (!haystack.toLowerCase().includes(needle)) return false;
  }
  return true;
}

export { toStaffMemberFromInvitation as invitationToStaffMember };
