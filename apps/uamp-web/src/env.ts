import { z } from 'zod';

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_R2_HOST: z.string().optional()
});

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_R2_HOST: process.env.NEXT_PUBLIC_R2_HOST
});

if (!parsed.success) {
  throw new Error(
    'Invalid UAMP frontend environment:\n' +
    parsed.error.issues.map((issue) => '- ' + issue.path.join('.') + ': ' + issue.message).join('\n')
  );
}

export const env = parsed.data;
