import { z } from 'zod';
import { Uuid } from './common.js';
import { MfaMethodSchema, UserRoleSchema } from './enums.js';
import { PERMISSIONS, type Permission } from './permissions.js';
import { CONFIRM_PASSWORD_MESSAGE, NewPassword } from './account.js';

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

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().optional(),
});
export type LoginBody = z.infer<typeof LoginBody>;

/**
 * A successful password check may still require a second factor: `user` is null
 * and `mfaRequired` is true until `/auth/mfa/verify` completes.
 */
export const LoginResponse = z.object({
  data: z.object({
    user: SessionUser.nullable(),
    mfaRequired: z.boolean(),
    mfaMethods: z.array(MfaMethodSchema),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

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
export const SignupBody = z
  .object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    country: z.string().length(2),
    accountType: z.enum(['individual', 'company']),
    password: NewPassword,
    confirmPassword: z.string(),
    description: z.string().max(500).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type SignupBody = z.infer<typeof SignupBody>;

export const SignupStartResponse = z.object({
  data: z.object({
    email: z.string().email(),
    verificationRequired: z.literal(true),
    /** The resend button's cooldown, in seconds. */
    resendAfterSeconds: z.literal(30),
    /** The OTP's lifetime, in seconds: ten minutes. */
    expiresInSeconds: z.literal(600),
  }),
});
export type SignupStartResponse = z.infer<typeof SignupStartResponse>;

export const SignupVerifyBody = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type SignupVerifyBody = z.infer<typeof SignupVerifyBody>;

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
