import { z } from 'zod';

export const API_MOCKING_ENABLED = 'enabled';

export const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_API_MOCKING: z.literal(API_MOCKING_ENABLED).optional(),
  NEXT_PUBLIC_R2_HOST: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_BUILD_LABEL: z.string().optional(),
  NEXT_PUBLIC_NODE_LABEL: z.string().optional(),
});

export type Env = z.infer<typeof PublicEnvSchema>;

/** 
 * Read the public variables directly from process.env so Next.js can 
 * statically inline them into the client bundle. 
 */
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
  };
}

export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

export function parseEnv(): Env {
  // Call readPublicEnv() directly to get the inlined values
  const source = readPublicEnv();
  const result = PublicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export const env: Env = parseEnv();