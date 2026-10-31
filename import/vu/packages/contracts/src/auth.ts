import { z } from 'zod';
import { Uuid } from './common';
import { UserRoleSchema } from './enums';
import { PERMISSIONS, type Permission } from './permissions';
import { NewPassword } from './account';

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
 * the identical generic body either way (an unregistered address receives a
 * signup-invitation email instead of a link; see `POST /auth/magic-link`).
 */
export const MagicLinkRequestBody = z
  .object({
    email: z.string().email(),
    /**
     * Optional same-origin path the browser is returned to after the MFA step.
     * It rides along inside the emailed verify URL; the API sanitises it on
     * both legs (single `/`, never protocol-relative, never absolute).
     */
    next: z.string().max(500).optional(),
    /**
     * Honeypot (Phase 4): rendered off-screen and never touched by a human.
     * A non-empty value means the submitter is a bot — the server silently
     * drops the request and still answers the identical generic 200.
     */
    website: z.string().max(300).optional(),
    /**
     * Epoch ms when the login form rendered (Phase 4 timing signal). A
     * submission faster than a human can read-and-type is dropped silently.
     */
    formTs: z.number().int().min(0).optional(),
    /**
     * Cloudflare Turnstile token (Phase 4). Required only once the caller's
     * IP has tripped the abuse soft limit AND server-side enforcement is on;
     * the 200 then carries `captchaRequired: true` until a token is supplied.
     */
    captchaToken: z.string().max(3000).optional(),
  })
  // STRICT on purpose: an unexpected `password` field is rejected outright —
  // no endpoint in the login surface accepts one, and a client still sending
  // one is running stale code and must fail loudly, not silently.
  .strict();
export type MagicLinkRequestBody = z.infer<typeof MagicLinkRequestBody>;

/** The acknowledgement every `POST /auth/magic-link` answers with — one literal, no variants. */
export const MAGIC_LINK_ACK_MESSAGE =
  'If an account exists for that address, a sign-in link is on its way.' as const;

/**
 * The byte-identical acknowledgement for known and unknown addresses alike.
 * `captchaRequired` depends ONLY on the caller's IP (the abuse soft limit),
 * never on registration status — the registered/unregistered responses for
 * the same IP stay byte-identical, so the endpoint still cannot enumerate.
 */
export const MagicLinkRequestResponse = z.object({
  message: z.literal(MAGIC_LINK_ACK_MESSAGE),
  captchaRequired: z.literal(true).optional(),
});
export type MagicLinkRequestResponse = z.infer<typeof MagicLinkRequestResponse>;

/**
 * A magic-link token is single-use, bound to its email + purpose, and lives for
 * 15 minutes; the verify leg consumes it atomically (replays fail).
 */
export const MagicLinkToken = z.string().min(20).max(400);

/**
 * `GET /auth/magic-link/verify` query. `next` is an optional same-origin path
 * the browser is sent to after the MFA step; the API sanitises it (single `/`,
 * never protocol-relative, never absolute) before it reaches a redirect.
 *
 * The verify leg answers with a bare `302` — the pre-MFA state travels in the
 * HttpOnly `vv_mfa` cookie, never in a URL or a JSON body — so there is no
 * verify *response* schema: the full session opens only when
 * `POST /auth/mfa/verify` accepts the six-digit code.
 */
export const MagicLinkVerifyQuery = z.object({
  /**
   * Deliberately loose: the HMAC inside the token is the real validator, and a
   * malformed link must still land on the web login screen with a clear error
   * instead of a raw JSON 400 in the browser.
   */
  token: z.string().min(1).max(2000),
  next: z.string().max(500).optional(),
});
export type MagicLinkVerifyQuery = z.infer<typeof MagicLinkVerifyQuery>;

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
 * Forced first-sign-in MFA setup (Phase 2). An administrator (or an unenrolled
 * client) who passes the magic-link leg lands on a SETUP challenge instead of
 * the usual verify step: they enrol an authenticator against the pre-MFA
 * session held in the HttpOnly `vv_mfa` cookie, and the first correct code
 * both verifies the factor and opens the full session.
 *
 * Administrators get `deadlineEpochMs` — the close of the visible 5:00 setup
 * window. When it passes (or they abandon), the account moves to
 * `blocked_mfa_setup` until a super admin unblocks it. The exempt super admin
 * never receives a setup challenge at all, and unenrolled CLIENTS get
 * `deadlineEpochMs: null` (routed to enrolment, never blocked, never bypassed).
 */
export const MfaSetupOptionsResponse = z.object({
  data: z.object({
    factorId: z.string().min(1),
    /** Inline SVG the authenticator app scans. */
    qrCodeSvg: z.string(),
    /** Base32 shared secret, shown for manual entry. */
    secret: z.string().regex(/^[A-Z2-7]+=*$/, 'Secret must be base32'),
    uri: z.string().startsWith('otpauth://totp/'),
    /** Epoch ms when the admin setup window closes; `null` = no deadline. */
    deadlineEpochMs: z.number().int().nullable(),
  }),
});
export type MfaSetupOptionsResponse = z.infer<typeof MfaSetupOptionsResponse>;

export const MfaSetupVerifyBody = z.object({
  factorId: z.string().min(1),
  code: OtpCode,
});
export type MfaSetupVerifyBody = z.infer<typeof MfaSetupVerifyBody>;

/** `blocked: true` only for administrators inside a timed setup window. */
export const MfaSetupAbandonResponse = z.object({
  data: z.object({ blocked: z.boolean() }),
});
export type MfaSetupAbandonResponse = z.infer<typeof MfaSetupAbandonResponse>;

/**
 * Signup (Task 40d): the details step of the verified three-step flow. The
 * password follows the shared rules — 12+ characters with upper, lower, digit
 * and symbol — and `POST /auth/signup` answers `SignupStartResponse`, never a
 * session: the mailbox OTP is what activates the account.
 *
 * Per the Phase 1 work order (Q3) the signup form is left AS-IS: the password
 * field is retained, but no password-login path is wired to it — the only login
 * credential is the magic link above.
 */
export const SignupBody = z
  .object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/)
      .optional(),
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
export type SignupBody = z.input<typeof SignupBody>;

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
 * The body-less `202 {}` acknowledgement: signup resend answers with it, and
 * the identical shape is the point — the route may not reveal whether the
 * address exists.
 */
export const EmptyObject = z.object({});
export type EmptyObject = z.infer<typeof EmptyObject>;

export type { Permission };
