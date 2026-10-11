import { describe, expect, it, vi } from 'vitest';
import { runPurgeLoginAttempts } from './purge-login-attempts';
import { runExpireInvitations } from './expire-invitations';
import { runFlagDormantAccounts } from './flag-dormant';
import { runStaleSignups } from './stale-signups';
import type { Logger, MaintenanceRepo } from '../ports';

const makeLogger = (): Logger => ({
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
});

const NOW = new Date('2026-09-24T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('runPurgeLoginAttempts', () => {
  it('deletes attempts older than the retention window and reports the count', async () => {
    const purge = vi.fn(async (_cutoff: Date) => 17);
    const summary = await runPurgeLoginAttempts({
      repo: { purgeLoginAttempts: purge } as Pick<MaintenanceRepo, 'purgeLoginAttempts'>,
      clock: { now: () => NOW },
      retentionDays: 30,
      logger: makeLogger(),
    });

    const cutoff = purge.mock.calls[0]?.[0];
    expect(cutoff?.getTime()).toBe(NOW.getTime() - 30 * DAY_MS);
    expect(summary).toEqual({ task: 'purge_login_attempts', affected: 17 });
  });

  it('propagates a repo failure so the queue retries', async () => {
    await expect(
      runPurgeLoginAttempts({
        repo: {
          purgeLoginAttempts: async () => {
            throw new Error('db down');
          },
        } as Pick<MaintenanceRepo, 'purgeLoginAttempts'>,
        clock: { now: () => NOW },
        retentionDays: 30,
        logger: makeLogger(),
      }),
    ).rejects.toThrow('db down');
  });
});

describe('runExpireInvitations', () => {
  it('expires pending invitations strictly at their deadline by default', async () => {
    const expire = vi.fn(async (_cutoff: Date) => 3);
    const summary = await runExpireInvitations({
      repo: { expireInvitations: expire } as Pick<MaintenanceRepo, 'expireInvitations'>,
      clock: { now: () => NOW },
      graceHours: 0,
      logger: makeLogger(),
    });

    expect(expire.mock.calls[0]?.[0]?.toISOString()).toBe(NOW.toISOString());
    expect(summary).toEqual({ task: 'expire_invitations', affected: 3 });
  });

  it('applies the grace window when configured', async () => {
    const expire = vi.fn(async (_cutoff: Date) => 0);
    await runExpireInvitations({
      repo: { expireInvitations: expire } as Pick<MaintenanceRepo, 'expireInvitations'>,
      clock: { now: () => NOW },
      graceHours: 6,
      logger: makeLogger(),
    });
    expect(expire.mock.calls[0]?.[0]?.getTime()).toBe(NOW.getTime() - 6 * 60 * 60 * 1000);
  });
});

describe('runFlagDormantAccounts', () => {
  it('flags clients unseen since the cutoff', async () => {
    const flag = vi.fn(async (_cutoff: Date) => 5);
    const summary = await runFlagDormantAccounts({
      repo: { flagDormantClients: flag } as Pick<MaintenanceRepo, 'flagDormantClients'>,
      clock: { now: () => NOW },
      dormantAfterDays: 90,
      logger: makeLogger(),
    });

    expect(flag.mock.calls[0]?.[0]?.getTime()).toBe(NOW.getTime() - 90 * DAY_MS);
    expect(summary).toEqual({ task: 'flag_dormant_accounts', affected: 5 });
  });
});

describe('runStaleSignups', () => {
  it('decays pending_verification signups older than the window', async () => {
    const flag = vi.fn(async (_cutoff: Date) => 2);
    const summary = await runStaleSignups({
      repo: { flagStaleSignups: flag } as Pick<MaintenanceRepo, 'flagStaleSignups'>,
      clock: { now: () => NOW },
      staleDays: 7,
      logger: makeLogger(),
    });

    expect(flag.mock.calls[0]?.[0]?.getTime()).toBe(NOW.getTime() - 7 * DAY_MS);
    expect(summary).toEqual({ task: 'stale_signups', affected: 2 });
  });
});
