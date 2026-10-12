import { describe, expect, it, vi } from 'vitest';
import { MAINTENANCE_TASKS } from '@vunvault/contracts';
import { registerSchedulers, SCHEDULES, schedulerId, type SchedulerQueue } from './scheduler';
import type { Logger } from '../ports';

function makeLogger(): Logger {
  return { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
}

function makeQueue() {
  const calls: Array<{ id: string; pattern: string; template: { name: string; data: { task: string } } }> = [];
  const queue: SchedulerQueue = {
    async upsertJobScheduler(id, repeat, template) {
      calls.push({ id, pattern: repeat.pattern, template });
      return id;
    },
  };
  return { queue, calls };
}

describe('SCHEDULES', () => {
  it('registers exactly the twelve catalogued patterns', () => {
    expect(SCHEDULES).toEqual([
      { task: 'metrics_rollup', pattern: '5 * * * *' },
      { task: 'node_health', pattern: '*/5 * * * *' },
      { task: 'threat_level', pattern: '*/15 * * * *' },
      { task: 'scheduled_publish', pattern: '*/5 * * * *' },
      { task: 'outbox_reenqueue', pattern: '*/2 * * * *' },
      { task: 'verify_chain', pattern: '0 */6 * * *' },
      { task: 'expire_invitations', pattern: '17 * * * *' },
      { task: 'media_scan', pattern: '23 * * * *' },
      { task: 'audit_snapshot', pattern: '0 2 * * *' },
      { task: 'purge_login_attempts', pattern: '0 3 * * *' },
      { task: 'flag_dormant_accounts', pattern: '30 3 * * *' },
      { task: 'stale_signups', pattern: '0 4 * * *' },
    ]);
  });

  it('schedules every catalogued task exactly once', () => {
    const tasks = SCHEDULES.map((entry) => entry.task);
    expect(new Set(tasks).size).toBe(tasks.length);
    for (const task of MAINTENANCE_TASKS) {
      expect(tasks, `no schedule registered for ${task}`).toContain(task);
    }
  });

  it('only schedules tasks the contract knows', () => {
    for (const entry of SCHEDULES) {
      expect(MAINTENANCE_TASKS).toContain(entry.task);
    }
  });

  it('gives every task a stable, unique scheduler id', () => {
    const ids = SCHEDULES.map((entry) => schedulerId(entry.task));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('maintenance:metrics_rollup');
  });
});

describe('registerSchedulers', () => {
  it('upserts one job per schedule with the task as both name and data', async () => {
    const { queue, calls } = makeQueue();
    const registered = await registerSchedulers(queue, makeLogger());

    expect(registered).toBe(12);
    expect(calls).toHaveLength(12);
    expect(calls[0]).toEqual({
      id: 'maintenance:metrics_rollup',
      pattern: '5 * * * *',
      template: { name: 'metrics_rollup', data: { task: 'metrics_rollup' } },
    });
  });

  it('is safe to call twice (every replica registers at boot)', async () => {
    const { queue, calls } = makeQueue();
    await registerSchedulers(queue, makeLogger());
    await registerSchedulers(queue, makeLogger());
    // upsertJobScheduler with the same stable id is the idempotency: the same
    // four ids appear twice, and BullMQ keeps one schedule per id.
    const ids = calls.map((call) => call.id);
    expect(new Set(ids).size).toBe(12);
    expect(ids).toHaveLength(24);
  });

  it('accepts an explicit schedule list (the Task 92 seam)', async () => {
    const { queue, calls } = makeQueue();
    const upsert = vi.spyOn(queue, 'upsertJobScheduler');
    await registerSchedulers(queue, makeLogger(), [{ task: 'purge_login_attempts', pattern: '0 3 * * *' }]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(calls[0]?.id).toBe('maintenance:purge_login_attempts');
  });
});
