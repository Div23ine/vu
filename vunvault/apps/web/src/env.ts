import { z } from 'zod';

/**
 * Public, build-time configuration.
 *
 * Every variable here starts with `NEXT_PUBLIC_`, which means Next inlines it into
 * the client bundle at build time. That has two consequences this module is written
 * around.
 *
 *  1. Nothing secret may ever be added here. A browser can read all of it, so a
 *     secret in this file is a published secret. Credentials live in the API's OCI
 *     Vault and never reach this app.
 *  2. `process.env` as an object does not exist in the browser — Next replaces
 *     individual `process.env.NEXT_PUBLIC_X` references statically. So the source
 *     object is assembled field by field in `readPublicEnv()` rather than handed
 *     over wholesale, which keeps this module importable from a client component.
 *
 * Validation is eager and fatal: a build without an API origin produces a page that
 * cannot reach the API, and that is much harder to diagnose than a boot failure
 * naming the variable.
 */

export const API_MOCKING_ENABLED = 'enabled';

export const PublicEnvSchema = z.object({
  /** Origin of the Fastify API, e.g. `https://api.vunvault.com`. */
  NEXT_PUBLIC_API_URL: z.string().url(),
  /** Canonical origin of this site; used for `metadataBase` and Open Graph URLs. */
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  /** Optional browser-side error reporting. */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  /** Exactly `enabled`, or absent: a typo must not silently turn mocking off. */
  NEXT_PUBLIC_API_MOCKING: z.literal(API_MOCKING_ENABLED).optional(),
  /** Host the CDN serves uploaded and generated images from. */
  NEXT_PUBLIC_R2_HOST: z.string().optional(),
  /**
   * Stripe publishable key (Task 66). Publishable by design — it tokenises
   * card fields in the browser; raw card data never reaches VUNVAULT. Absent
   * means stored-card updates are unavailable (the dialog says so).
   */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  /** Human-readable build label, shown in the admin footer. */
  NEXT_PUBLIC_BUILD_LABEL: z.string().optional(),
  /** Verifying-node label shown on the audit chain panel. */
  NEXT_PUBLIC_NODE_LABEL: z.string().optional(),
});

export type Env = z.infer<typeof PublicEnvSchema>;

/** Read the public variables one by one so Next can inline each reference. */
export function readPublicEnv(
  source: Record<string, string | undefined> = process.env,
): Record<keyof Env, string | undefined> {
  return {
    NEXT_PUBLIC_API_URL: source.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SENTRY_DSN: source.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_API_MOCKING: source.NEXT_PUBLIC_API_MOCKING,
    NEXT_PUBLIC_R2_HOST: source.NEXT_PUBLIC_R2_HOST,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_BUILD_LABEL: source.NEXT_PUBLIC_BUILD_LABEL,
    NEXT_PUBLIC_NODE_LABEL: source.NEXT_PUBLIC_NODE_LABEL,
  };
}

/** One readable line per problem: a boot failure must say what to set. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

export function parseEnv(source: Record<string, string | undefined> = readPublicEnv()): Env {
  const result = PublicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

/** The validated configuration. Throws at import time when it is incomplete. */
export const env: Env = parseEnv();
