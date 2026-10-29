import { z } from 'zod';
import { Uuid } from './common';
import { MfaMethodSchema, UserRoleSchema } from './enums';
import { PERMISSIONS, type Permission } from './permissions';
import { CONFIRM_PASSWORD_MESSAGE, NewPassword } from './account';

/** Claims the Supabase Auth Hook mints from `profiles.role` and `profiles.org_id`. */
export const JwtClaims = z.object({
  sub: Uuid,
  role: UserRoleSchema,
  org_id: Uuid.nullable(),
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type JwtClaims = z.infer<typeof JwtClaims>;

/** The session user the web app keeps in TanStack Query under `queryKeys.session()`. */
export const SessionUser = z.object({
  id: Uuid,
  email: z.string().email(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
  orgId: Uuid.nullable(),
  permissions: z.array(z.enum(PERMISSIONS)),
  mfaEnrolled: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUser>;

/**
 * Magic-link login (Phase 1): the ONLY credential the login flow accepts is an
 * email address. No route, component or API endpoint takes a password for login.
 * Whether the address is registered is never revealed — the route answers with
 * the identical generic body either way.
 */
export const MagicLinkRequestBody = z.object({
  email: z.string().email(),
});
export type MagicLinkRequestBody = z.infer<typeof MagicLinkRequestBody>;

/** The byte-identical acknowledgement for known and unknown addresses alike. */
export const MagicLinkRequestResponse = z.object({
  message: z.literal('If an account exists for that address, a sign-in link is on its way.'),
});
export type MagicLinkRequestResponse = z.infer<typeof MagicLinkRequestResponse>;

/**
 * A magic-link token is single-use, bound to its email + purpose, and lives for
 * 15 minutes; the verify leg consumes it atomically (replays fail).
 */
export const MagicLinkToken = z.string().min(20).max(400);

/**
 * After the link passes, every login continues at the six-digit MFA step:
 * `MagicLinkVerifyResponse` carries the pre-MFA challenge state, never a full
 * session. The full session opens only when `POST /auth/mfa/verify` accepts the
 * code against the HttpOnly `vv_mfa` challenge cookie.
 */
export const MagicLinkVerifyResponse = z.object({
  data: z.object({
    status: z.enum(['mfa_required', 'mfa_setup_required']),
    email: z.string().email(),
    methods: z.array(MfaMethodSchema),
  }),
});
export type MagicLinkVerifyResponse = z.infer<typeof MagicLinkVerifyResponse>;

const OtpCode = z
  .string()
  .length(6)
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const MfaVerifyBody = z.discriminatedUnion('method', [
  z.object({ method: z.literal('totp'), code: OtpCode }),
  z.object({ method: z.literal('email_otp'), code: OtpCode }),
  z.object({ method: z.literal('webauthn'), assertion: z.unknown() }),
]);
export type MfaVerifyBody = z.infer<typeof MfaVerifyBody>;

/**
 * Signup (Task 40d): the details step of the verified three-step flow. The
 * password follows the shared rules — 12+ characters with upper, lower, digit
 * and symbol — and `POST /auth/signup` answers `SignupStartResponse`, never a
 * session: the mailbox OTP is what activates the account.
 */
/**
 * Passwordless signup, step 1: email + display name. No password exists in
 * this flow; possession of the mailbox plus a six-digit code is the auth.
 */
export const SignupBody = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .optional(),
  country: z.string().length(2).optional(),
  accountType: z.string().optional(),
  password: z.string().min(8),
});
export type SignupBody = z.infer<typeof SignupBody>;

export const SignupConfirmBody = z.object({ token: z.string().min(8).max(200) });
export type SignupConfirmBody = z.infer<typeof SignupConfirmBody>;

export const SignupStartResponse = z.object({
  data: z.object({ email: z.string().email() }),
});
export type SignupStartResponse = z.infer<typeof SignupStartResponse>;

export const SignupVerifyBody = z.object({
  handle: z.string().min(8).max(200),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type SignupVerifyBody = z.infer<typeof SignupVerifyBody>;

export const AuthFlowHandle = z.object({
  data: z.object({ handle: z.string(), method: z.enum(['email', 'totp']) }),
});
export type AuthFlowHandle = z.infer<typeof AuthFlowHandle>;

export const SignupResendBody = z.object({
  email: z.string().email(),
});
export type SignupResendBody = z.infer<typeof SignupResendBody>;

/**
 * The body-less `202 {}` acknowledgement: resend and forgot-password answer with
 * it, and the identical shape is the point — neither route may reveal whether the
 * address exists.
 */
export const EmptyObject = z.object({});
export type EmptyObject = z.infer<typeof EmptyObject>;

export const ForgotPasswordBody = z.object({
  email: z.string().email(),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>;

/**
 * The token is the 32-random-byte base64url string from the reset email. The
 * password rules and the confirm refine match `ChangePasswordBody`; there is no
 * "reused password" refine because a reset has no current password to compare to.
 */
export const ResetPasswordBody = z
  .object({
    token: z.string().min(32),
    newPassword: NewPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: CONFIRM_PASSWORD_MESSAGE,
  });
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;

export type { Permission };
