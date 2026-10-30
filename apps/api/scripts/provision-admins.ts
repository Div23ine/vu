import process from 'node:process';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { asExecutor } from '../src/audit/repo.js';
import type { Tx } from '../src/plugins/db.js';
import { SqlUsersRepo } from '../src/routes/v1/users/repo.js';
import { UsersService } from '../src/routes/v1/users/service.js';

/**
 * Administrator-roster provisioning (Phase 2, magic-link work order §2).
 *
 *   pnpm --filter @vunvault/api provision:admins
 *
 * Materialises the nine-slot roster from `src/lib/admin-roster.ts` — the
 * single source of truth for administrator provisioning. IDEMPOTENT: filled
 * slots that already have a profile are skipped (a drifted role is
 * corrected), `null` placeholder slots are ignored until they are filled in
 * the roster file. Every newly created identity is audited USER_PROVISIONED
 * in the same transaction as its rows.
 *
 * New identities get `email_confirm: true`, a random never-used password
 * (magic links are the only credential) and `mfa_enrolled = false`, so the
 * first sign-in runs the forced 5:00 MFA setup window — except for the
 * exempt super admin (`divine@vunvault.com`, Divine Gospel), who signs
 * straight in with optional MFA.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp({ env });
  await app.ready();

  const summary = await app.withTx(async (tx: Tx) => {
    const executor = asExecutor(tx);
    const service = new UsersService({
      repo: new SqlUsersRepo(executor),
      supabase: app.supabase,
      webOrigin: env.WEB_ORIGIN,
    });
    const result = await service.provisionAdminRoster();
    for (const created of result.created) {
      await app.audit.append(executor, {
        eventType: 'USER_PROVISIONED',
        actor: { id: null, label: 'admin-roster' },
        subject: created.email,
        message: `${created.email} provisioned from the administrator roster (${created.role})`,
        details: { source: 'admin-roster', role: created.role, userId: created.userId },
      });
    }
    for (const corrected of result.roleCorrected) {
      await app.audit.append(executor, {
        eventType: 'PERMISSION_CHANGED',
        actor: { id: null, label: 'admin-roster' },
        subject: corrected.email,
        message: `${corrected.email} role corrected to ${corrected.role} from the administrator roster`,
        details: { source: 'admin-roster', to: corrected.role },
      });
    }
    return result;
  });

  app.log.info(
    {
      created: summary.created.map((entry) => entry.email),
      roleCorrected: summary.roleCorrected.map((entry) => entry.email),
      skipped: summary.skipped,
    },
    'admin roster provisioning complete',
  );
  await app.close();
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('admin roster provisioning failed:', error);
  process.exit(1);
});
