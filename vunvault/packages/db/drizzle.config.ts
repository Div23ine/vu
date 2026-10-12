import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * `url` reads `DIRECT_URL` — schema introspection and generation touch session
 * features, so they must bypass the Supavisor transaction pooler (port 6543) and
 * use the direct connection (port 5432).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? '',
  },
});
