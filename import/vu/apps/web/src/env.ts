import { z } from 'zod';

/**
 * Public, build-time configuration.
 * Every variable here starts with `NEXT_PUBLIC_`, which means Next inlines it into
 * the client bundle at build time. That has two consequences this module is written
 * around.
 *
 * Nothing secret may ever be added here. A browser can read all of it, so a
 * secret in this file is a published secret. Credentials live in the API's OCI
 * Vault and never reach this app.
 *
 * `process.env` as an object does not exist in the browser — Next replaces
 * individual `process.env.NEXT_PUBLIC_X` references statically. So the source
 * object is assembled field by field in `readPublicEnv()` rather than handed
 * over wholesale, which keeps this module importable from a client component.
 *
 * Validation is eager and fatal: a build without an API origin produces a page that
 * cannot reach the API, and that is much harder to diagnose than a boot failure
 * naming the variable.
 */
export const API_MOCKING_ENABLED = 'enabled';
export const API_MOCKING_DISABLED = 'disabled';
export type ApiMockingFlag = typeof API_MOCKING_ENABLED | typeof API_MOCKING_DISABLED;

/**
 * Environment variables loaded from `.env` files are always strings. If a line
 * is empty (e.g., `NEXT_PUBLIC_SENTRY_DSN=`), Next.js provides an empty string
 * `""` rather than `undefined`. Zod's `.optional()` allows `undefined` but fails
 * on `""` when a URL format is expected. These helpers preprocess empty strings
 * into `undefined` so copying `.env.example` to `.env.local` doesn't break the build.
 */
const optionalString = z.preprocess((val) => (val === '' ? undefined : val), z.string().optional());
const optionalUrl = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().url().optional(),
);

/**
 * The mocking flag is an explicit `enabled` / `disabled` switch, or absent.
 *
 * It is deliberately NOT `z.string().optional()`: a typo (`enabledd`, `true`,
 * `1`) must fail the build rather than silently leave mocking off in an
 * environment that expected it on. Absence is treated as "disabled" by
 * callers, so omitting the variable is also a valid, intentional choice.
 */
const optionalMockingFlag = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.enum([API_MOCKING_ENABLED, API_MOCKING_DISABLED]).optional(),
);

export const PublicEnvSchema = z.object({
  /** Origin of the Fastify API, e.g. `https://api.vunvault.com`. */
  NEXT_PUBLIC_API_URL: z.string().url(),
  /** Canonical origin of this site; used for `metadataBase` and Open Graph URLs. */
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  /** Optional browser-side error reporting. */
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  /**
   * Exactly `enabled` or `disabled`, or absent. A typo must not silently turn
   * mocking off; absence means "disabled" at the call site.
   */
  NEXT_PUBLIC_API_MOCKING: optionalMockingFlag,
  /** Host the CDN serves uploaded and generated images from. */
  NEXT_PUBLIC_R2_HOST: optionalString,
  /**
   * Stripe publishable key (Task 66). Publishable by design — it tokenises
   * card fields in the browser; raw card data never reaches VUNVAULT. Absent
   * means stored-card updates are unavailable (the dialog says so).
   */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  /** Human-readable build label, shown in the admin footer. */
  NEXT_PUBLIC_BUILD_LABEL: optionalString,
  NEXT_PUBLIC_ZURA_LLM_URL: optionalUrl,
  /** Verifying-node label shown on the audit chain panel. */
  NEXT_PUBLIC_NODE_LABEL: optionalString,
  /**
   * Cloudflare Turnstile site key (public by design — it only renders
   * challenges). Needed when the API runs with `TURNSTILE_ENFORCE=true`;
   * absent means the captcha-gated login view shows its fallback copy.
   */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
});

export type Env = z.infer<typeof PublicEnvSchema>;

/** Read the public variables directly from process.env so Next/Turbopack
 * can statically replace them in the browser bundle. */
export function readPublicEnv(): Record<keyof Env, string | undefined> {
  return {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING,
    NEXT_PUBLIC_R2_HOST: process.env.NEXT_PUBLIC_R2_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_BUILD_LABEL: process.env.NEXT_PUBLIC_BUILD_LABEL,
    NEXT_PUBLIC_NODE_LABEL: process.env.NEXT_PUBLIC_NODE_LABEL,
    NEXT_PUBLIC_ZURA_LLM_URL: process.env.NEXT_PUBLIC_ZURA_LLM_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  };
}

/** One readable line per problem: a boot failure must say what to set. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/** Parse and validate the environment. */
export function parseEnv(): Env {
  const result = PublicEnvSchema.safeParse(readPublicEnv());
  if (!result.success) {
    throw new Error(`Invalid public environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

/** The validated configuration. Throws at import time when it is incomplete. */
export const env: Env = parseEnv();

/**
 * True only when the environment explicitly says `NEXT_PUBLIC_API_MOCKING=enabled`.
 * Absence, empty, or `disabled` all yield `false`, so the default path is the
 * real API — mocking is opt-in and never turns itself on by accident.
 */
export function isApiMockingEnabled(): boolean {
  return env.NEXT_PUBLIC_API_MOCKING === API_MOCKING_ENABLED;
}
