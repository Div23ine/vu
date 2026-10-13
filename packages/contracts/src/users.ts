import { TEAMS, USER_ROLES, type Team, type UserRole } from '@vunvault/db/enum-values';
import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid } from './common';
import {
  AccountStatusSchema,
  AccessTierSchema,
  MfaMethodSchema,
  TeamSchema,
  UserRoleSchema,
} from './enums';

/**
 * Staff roster, invitations and the administrative actions on a member.
 *
 * The `@vunvault.com` domain restriction and the staff-role/staff-team subsets are
 * enforced here so no screen can invite a client account into the staff console.
 */

/** Every role except `client` — the roles an invitation may carry. */
export const STAFF_ROLES = USER_ROLES.filter((role) => role !== 'client') as [
  Exclude<UserRole, 'client'>,
  ...Exclude<UserRole, 'client'>[],
];

/** The six delivery teams a staff member can belong to. */
export const STAFF_TEAMS = TEAMS.slice(0, 6) as [Team, ...Team[]];

export const StaffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const StaffTeamSchema = z.enum(STAFF_TEAMS);
export type StaffTeam = z.infer<typeof StaffTeamSchema>;

export const StaffMember = z.object({
  id: Uuid,
  fullName: z.string(),
  email: z.string().email(),
  initials: z.string(),
  role: UserRoleSchema,
  team: TeamSchema.nullable(),
  accountStatus: AccountStatusSchema,
  accessTier: AccessTierSchema,
  baseLocation: z.string().nullable(),
  scopeSummary: z.string().nullable(),
  mfa: z.object({
    enrolled: z.boolean(),
    methods: z.array(MfaMethodSchema),
  }),
  joinedAt: IsoDateTime,
  lastActiveAt: IsoDateTime.nullable(),
  suspendedAt: IsoDateTime.nullable(),
  accessReviewDue: z.string().nullable(),
});
export type StaffMember = z.infer<typeof StaffMember>;

export const StaffListQuery = PageQuery.extend({
  role: UserRoleSchema.optional(),
  status: AccountStatusSchema.optional(),
  mfa: z.enum(['enrolled', 'not_enrolled']).optional(),
});
export type StaffListQuery = z.infer<typeof StaffListQuery>;

export const StaffSummary = z.object({
  activeMembers: z.number().int().nonnegative(),
  securityAnalysts: z.number().int().nonnegative(),
  operators: z.number().int().nonnegative(),
  pendingInvitations: z.number().int().nonnegative(),
  mfaEnrolmentPercent: z.number().min(0).max(100),
  accountsWithoutMfa: z.number().int().nonnegative(),
  dormantAccounts: z.number().int().nonnegative(),
  onboardedThisMonth: z.number().int().nonnegative(),
});
export type StaffSummary = z.infer<typeof StaffSummary>;

export const InvitationChecklistSchema = z.object({
  mfaEnrolmentMandatory: z.literal(true),
  ndaOnFile: z.boolean(),
  backgroundVerified: z.boolean(),
  trainingAcknowledged: z.boolean(),
});
export type InvitationChecklist = z.infer<typeof InvitationChecklistSchema>;

/** Drafting (`draft: true`) stores the invitation without sending the email. */
export const ProvisionInviteBody = z.object({
  fullName: z.string().min(2),
  email: z
    .string()
    .email()
    .endsWith('@vunvault.com', 'Staff invitations require a @vunvault.com address'),
  jobTitle: z.string().optional(),
  baseLocation: z.string().optional(),
  role: StaffRoleSchema,
  team: StaffTeamSchema,
  accessTier: AccessTierSchema,
  accessReviewDue: z.string().date().optional(),
  scopeNotes: z.string().max(1000).optional(),
  checklist: InvitationChecklistSchema,
  draft: z.boolean().optional(),
});
export type ProvisionInviteBody = z.infer<typeof ProvisionInviteBody>;

export const Invitation = z.object({
  id: Uuid,
  email: z.string().email(),
  fullName: z.string(),
  role: UserRoleSchema,
  team: TeamSchema,
  status: z.enum(['draft', 'pending', 'accepted', 'revoked', 'expired']),
  expiresAt: IsoDateTime,
  resendCount: z.number().int().nonnegative(),
});
export type Invitation = z.infer<typeof Invitation>;

/**
 * What an invitee sees before they set a password. The token itself is never
 * echoed back, and an unknown, expired or already-used token produces the same
 * `404 not_found` — the endpoint must not reveal which invitations exist.
 */
export const InvitationPreview = z.object({
  email: z.string().email(),
  fullName: z.string(),
  role: UserRoleSchema,
  roleLabel: z.string(),
  team: TeamSchema,
  teamLabel: z.string(),
  expiresAt: IsoDateTime,
});
export type InvitationPreview = z.infer<typeof InvitationPreview>;

/**
 * Staff passwords are 14 characters minimum with the same complexity rules as a
 * password change; the invitation email proves mailbox ownership, so the Supabase
 * user is created already confirmed.
 */
export const AcceptInvitationBody = z
  .object({
    password: z.string().min(14),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match',
  });
export type AcceptInvitationBody = z.infer<typeof AcceptInvitationBody>;

export const UserActionBody = z.object({
  reason: z.string().max(500).optional(),
});
export type UserActionBody = z.infer<typeof UserActionBody>;

export const ChangeRoleBody = z.object({
  role: UserRoleSchema,
});
export type ChangeRoleBody = z.infer<typeof ChangeRoleBody>;
