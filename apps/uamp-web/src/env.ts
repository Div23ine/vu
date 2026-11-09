import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_AUTH_URL: z.string().url(),
});

function readEnv() {
  return {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  };
}

const parsed = EnvSchema.safeParse(readEnv());
if (!parsed.success) {
  throw new Error(
    `Invalid UAMP HQ public environment:\n${parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n')}`,
  );
}

export const env = parsed.data;