import { NOTIFICATION_EVENTS } from '@vunvault/db/enum-values';
import { z } from 'zod';
import { IsoDateTime, Uuid } from './common.js';
import { MfaMethodSchema, TeamSchema, UserRoleSchema } from './enums.js';
import type { NotificationEvent, RecoveryQuestion, Team, UserRole } from './enums.js';

/**
 * Password Manager, MFA self-service, device sessions, Profile Settings and
 * notification preferences.
 *
 * Every route here acts on the authenticated user only. Password *hashing* is
 * owned by Supabase Auth — this package models the rules the UI enforces and the
 * API re-checks, never a hash.
 */

export const PASSWORD_RULES = [
  { id: 'len', label: 'At least 12 characters' },
  { id: 'upper', label: 'One uppercase letter' },
  { id: 'lower', label: 'One lowercase letter' },
  { id: 'digit', label: 'One number' },
  { id: 'symbol', label: 'One symbol (!@#$…)' },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id'];

/**
 * 12 characters is the client minimum. The API raises it to 14 for staff roles —
 * a role-dependent minimum cannot be expressed in a shared schema, so it is
 * enforced in the route (Task 27) on top of these rules.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const STAFF_PASSWORD_MIN_LENGTH = 14;

export const PASSWORD_RULE_TESTS: Record<PasswordRuleId, (password: string) => boolean> = {
  len: (password) => password.length >= PASSWORD_MIN_LENGTH,
  upper: (password) => /[A-Z]/.test(password),
  lower: (password) => /[a-z]/.test(password),
  digit: (password) => /\d/.test(password),
  symbol: (password) => /[^A-Za-z0-9]/.test(password),
};

/** Per-rule ticks for the strength meter. */
export function passwordRuleResults(password: string): Record<PasswordRuleId, boolean> {
  return {
    len: PASSWORD_RULE_TESTS.len(password),
    upper: PASSWORD_RULE_TESTS.upper(password),
    lower: PASSWORD_RULE_TESTS.lower(password),
    digit: PASSWORD_RULE_TESTS.digit(password),
    symbol: PASSWORD_RULE_TESTS.symbol(password),
  };
}

export const PASSWORD_SCORE_LABELS = {
  0: 'Awaiting input',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
} as const;

export type PasswordScore = keyof typeof PASSWORD_SCORE_LABELS;

/**
 * Strength meter: 0 for an empty field, otherwise the count of satisfied rules
 * mapped onto 1–4 (`Weak` … `Strong`).
 */
export function scorePassword(password: string): { score: PasswordScore; label: string } {
  if (password.length === 0) return { score: 0, label: PASSWORD_SCORE_LABELS[0] };
  const satisfied = PASSWORD_RULES.filter((rule) => PASSWORD_RULE_TESTS[rule.id](password)).length;
  const score = Math.min(4, Math.max(1, satisfied - 1)) as PasswordScore;
  return { score, label: PASSWORD_SCORE_LABELS[score] };
}

export const CONFIRM_PASSWORD_MESSAGE = 'Both entries must match exactly.';
export const PASSWORD_REUSED_MESSAGE = 'Choose a password you have not used before.';

export const NewPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .refine(PASSWORD_RULE_TESTS.upper, 'One uppercase letter')
  .refine(PASSWORD_RULE_TESTS.lower, 'One lowercase letter')
  .refine(PASSWORD_RULE_TESTS.digit, 'One number')
  .refine(PASSWORD_RULE_TESTS.symbol, 'One symbol (!@#$…)');

export const ChangePasswordBody = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: NewPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: PASSWORD_REUSED_MESSAGE,
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: CONFIRM_PASSWORD_MESSAGE,
  });
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const TotpEnrollStart = z.object({
  data: z.object({
    factorId: z.string(),
    /** Inline SVG the authenticator app scans. */
    qrCodeSvg: z.string(),
    /** Base32 shared secret, shown for manual entry. */
    secret: z.string().regex(/^[A-Z2-7]+=*$/, 'Secret must be base32'),
    uri: z.string().startsWith('otpauth://totp/'),
  }),
});
export type TotpEnrollStart = z.infer<typeof TotpEnrollStart>;

export const OtpCode = z
  .string()
  .length(6)
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const TotpVerifyBody = z.object({
  factorId: z.string().min(1),
  code: OtpCode,
});
export type TotpVerifyBody = z.infer<typeof TotpVerifyBody>;

/** Provider-generated WebAuthn options are opaque to this contract. */
export const WebauthnRegisterOptionsResponse = z.object({ data: z.unknown() });
export type WebauthnRegisterOptionsResponse = z.infer<typeof WebauthnRegisterOptionsResponse>;

export const WebauthnRegisterVerifyBody = z.object({
  deviceName: z.string().max(80).optional(),
  credential: z.unknown(),
});
export type WebauthnRegisterVerifyBody = z.infer<typeof WebauthnRegisterVerifyBody>;

export const WebauthnKey = z.object({
  id: Uuid,
  deviceName: z.string().nullable(),
  createdAt: IsoDateTime,
  lastUsedAt: IsoDateTime.nullable(),
});
export type WebauthnKey = z.infer<typeof WebauthnKey>;

/** Display form of a recovery code: three groups of four uppercase alphanumerics. */
export const RECOVERY_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const RECOVERY_CODES_PER_BATCH = 10;

export const RecoveryCodeBody = z.object({
  code: z.string().regex(RECOVERY_CODE_PATTERN, 'Enter a code in the form XXXX-XXXX-XXXX'),
});
export type RecoveryCodeBody = z.infer<typeof RecoveryCodeBody>;

export const RecoveryCodesResponse = z.object({
  data: z.object({
    /** Shown exactly once; only the SHA-256 digest is stored. */
    codes: z.array(z.string().regex(RECOVERY_CODE_PATTERN)).length(RECOVERY_CODES_PER_BATCH),
    batchId: Uuid,
    generatedAt: IsoDateTime,
  }),
});
export type RecoveryCodesResponse = z.infer<typeof RecoveryCodesResponse>;

export const RecoveryCodesStatus = z.object({
  generated: z.boolean(),
  remaining: z.number().int().min(0).max(RECOVERY_CODES_PER_BATCH),
  total: z.literal(RECOVERY_CODES_PER_BATCH),
  generatedAt: IsoDateTime.nullable(),
});
export type RecoveryCodesStatus = z.infer<typeof RecoveryCodesStatus>;

export const MfaStatus = z.object({
  totp: z.object({
    enabled: z.boolean(),
    factorId: z.string().nullable(),
  }),
  webauthn: z.object({ keys: z.array(WebauthnKey) }),
  recovery: RecoveryCodesStatus,
  require2fa: z.boolean(),
  lastFactorChangeAt: IsoDateTime.nullable(),
});
export type MfaStatus = z.infer<typeof MfaStatus>;

export const SessionView = z.object({
  id: z.string(),
  deviceLabel: z.string(),
  ip: z.string().nullable(),
  /** Rendered location, e.g. `Nairobi, KE`. */
  location: z.string().nullable(),
  mfaMethod: MfaMethodSchema.nullable(),
  startedAt: IsoDateTime,
  current: z.boolean(),
});
export type SessionView = z.infer<typeof SessionView>;

export const SessionsResponse = z.object({ data: z.array(SessionView) });
export type SessionsResponse = z.infer<typeof SessionsResponse>;

export const RevokeOthersResponse = z.object({
  data: z.object({ revoked: z.number().int().nonnegative() }),
});
export type RevokeOthersResponse = z.infer<typeof RevokeOthersResponse>;

export const TIMEZONES = {
  'Africa/Nairobi': 'Africa/Nairobi — EAT (UTC+3)',
  'Africa/Lagos': 'Africa/Lagos — WAT (UTC+1)',
  'Africa/Accra': 'Africa/Accra — GMT (UTC+0)',
  'Africa/Johannesburg': 'Africa/Johannesburg — SAST (UTC+2)',
  'Europe/London': 'Europe/London — GMT/BST',
  'Europe/Berlin': 'Europe/Berlin — CET/CEST',
  'America/New_York': 'America/New_York — ET',
  'Asia/Dubai': 'Asia/Dubai — GST (UTC+4)',
} as const;

export type Timezone = keyof typeof TIMEZONES;

export const TimezoneSchema = z.enum(Object.keys(TIMEZONES) as [Timezone, ...Timezone[]]);

export const LANGUAGES = {
  'en-GB': 'English (United Kingdom)',
  'en-US': 'English (United States)',
  sw: 'Kiswahili',
  fr: 'Français',
} as const;

export type Language = keyof typeof LANGUAGES;

export const LanguageSchema = z.enum(Object.keys(LANGUAGES) as [Language, ...Language[]]);

export const RECOVERY_QUESTION_LABELS: Record<RecoveryQuestion, string> = {
  first_pet: 'What was the name of your first pet?',
  birth_city: 'In what city were you born?',
  maiden_name: "What is your mother's maiden name?",
  first_car: 'What was your first car?',
  first_school: 'What was the name of your first school?',
};

export const ProfileSettings = z.object({
  id: Uuid,
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  jobTitle: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  timezone: TimezoneSchema,
  language: LanguageSchema,
  bio: z.string().max(400).nullable(),
  avatarUrl: z.string().nullable(),
  role: UserRoleSchema,
  team: TeamSchema.nullable(),
  memberSince: IsoDateTime,
  username: z.string(),
  /** Short MFA summary, e.g. `Hardware key`. */
  mfaSummary: z.string(),
  lastSignInAt: IsoDateTime.nullable(),
  activeSessions: z.number().int().nonnegative(),
  require2fa: z.boolean(),
});
export type ProfileSettings = z.infer<typeof ProfileSettings>;

/** Email is deliberately absent: it is owned by Supabase Auth and read-only here. */
export const UpdateProfileSettingsBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().min(2),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  timezone: TimezoneSchema,
  language: LanguageSchema,
  bio: z.string().max(400).optional(),
});
export type UpdateProfileSettingsBody = z.infer<typeof UpdateProfileSettingsBody>;

export const AVATAR_MAX_BYTES = 4_194_304;

export const AvatarUploadRequest = z.object({
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  sizeBytes: z.number().int().positive().max(AVATAR_MAX_BYTES),
});
export type AvatarUploadRequest = z.infer<typeof AvatarUploadRequest>;

export const AvatarUploadResponse = z.object({
  data: z.object({
    uploadUrl: z.string().url(),
    objectKey: z.string(),
    expiresAt: IsoDateTime,
  }),
});
export type AvatarUploadResponse = z.infer<typeof AvatarUploadResponse>;

export const AvatarConfirmBody = z.object({ objectKey: z.string().min(1) });
export type AvatarConfirmBody = z.infer<typeof AvatarConfirmBody>;

export const SECURITY_POSTURE_ITEMS = [
  'Hardware-key MFA registered',
  'Recovery codes generated',
  'Password updated within 90 days',
  'Register a backup hardware key',
] as const;

export const SecurityPostureItem = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type SecurityPostureItem = z.infer<typeof SecurityPostureItem>;

/**
 * `score` is `round(100 × completed ÷ total)` — the formula, not the prototype's
 * hard-coded 80 for "3 of 4".
 */
export const SecurityPosture = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(['Strong posture', 'Fair posture', 'Weak posture']),
  completed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  items: z.array(SecurityPostureItem),
});
export type SecurityPosture = z.infer<typeof SecurityPosture>;

export function postureScore(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * completed) / total);
}

export const NOTIFICATION_EVENT_META: Record<
  NotificationEvent,
  { group: string; title: string; description: string }
> = {
  signin_new_device: {
    group: 'Security & Access',
    title: 'Sign-in from new device',
    description: 'Alert when a new device or unrecognised IP authenticates to your account.',
  },
  credentials_changed: {
    group: 'Security & Access',
    title: 'Password or 2FA changed',
    description: 'Immediate notification of any credential change on your account.',
  },
  failed_auth: {
    group: 'Security & Access',
    title: 'Failed authentication attempts',
    description: 'Burst of failed sign-ins against your account from any source.',
  },
  scan_completed: {
    group: 'Scan Operations',
    title: 'Scan completed',
    description: 'A job assigned to you finishes execution and results are ready.',
  },
  job_awaiting_review: {
    group: 'Scan Operations',
    title: 'Job awaiting review gate',
    description: 'A job is blocked on the Mandatory Admin Review Gate and requires your attention.',
  },
  critical_finding: {
    group: 'Scan Operations',
    title: 'Critical finding detected',
    description: 'A scan has produced a critical severity finding requiring escalation.',
  },
  advisory_broadcast: {
    group: 'Threat Intelligence',
    title: 'Zero-day advisory broadcast',
    description: 'A new emergency advisory has been dispatched to client dashboards.',
  },
  threat_level_change: {
    group: 'Threat Intelligence',
    title: 'Threat level change',
    description: 'Global zero-day threat level moves up or down a step.',
  },
  content_awaiting_moderation: {
    group: 'Administrative',
    title: 'Content awaiting moderation',
    description: 'A staff-authored blog post, advisory or product listing is queued for review.',
  },
  team_member_provisioned: {
    group: 'Administrative',
    title: 'New team member provisioned',
    description: 'An invitation is sent or a new account is created on the platform.',
  },
  weekly_digest: {
    group: 'Administrative',
    title: 'Weekly digest',
    description: 'A Monday morning summary of scans, releases, threats and audit events.',
  },
};

export const NOTIFICATION_GROUPS = [
  'Security & Access',
  'Scan Operations',
  'Threat Intelligence',
  'Administrative',
] as const;

export const NOTIFICATION_CHANNEL_LABELS: Record<'in_app' | 'email' | 'sms' | 'push', string> = {
  in_app: 'In-App',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

/**
 * Credential changes, SEV-1 broadcasts, review-gate escalations and
 * incident-commander pages ignore quiet hours and channel opt-outs.
 */
export const NOTIFICATION_EVENT_ORDER = NOTIFICATION_EVENTS;

export const ChannelToggles = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
});
export type ChannelToggles = z.infer<typeof ChannelToggles>;

/** The planner's defaults, applied when a user has no row for an event. */
export const DEFAULT_CHANNEL_TOGGLES: ChannelToggles = {
  inApp: true,
  email: true,
  sms: false,
  push: false,
};

const TimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the 24-hour form HH:MM')
  .nullable();

export const NotificationPrefs = z.object({
  events: z.record(z.enum(NOTIFICATION_EVENTS), ChannelToggles),
  quietHours: z.object({
    enabled: z.boolean(),
    from: TimeOfDay,
    to: TimeOfDay,
  }),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

export const UpdateNotificationPrefsBody = NotificationPrefs;
export type UpdateNotificationPrefsBody = z.infer<typeof UpdateNotificationPrefsBody>;

export const DeactivationRequestBody = z.object({
  reason: z.string().min(10).max(500),
});
export type DeactivationRequestBody = z.infer<typeof DeactivationRequestBody>;

export const SecurityResponse = z.object({
  data: MfaStatus.extend({ posture: SecurityPosture }),
});
export type SecurityResponse = z.infer<typeof SecurityResponse>;

export type { NotificationEvent, Team, UserRole };
