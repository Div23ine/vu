import { describe, expect, it } from 'vitest';
import {
  MAINTENANCE_TASKS,
  MaintenanceJobPayload,
  QUEUE_NAME_VALUES,
  QUEUE_PAYLOADS,
} from './queues.js';

describe('MAINTENANCE_TASKS', () => {
  it('lists exactly the twelve scheduled tasks in wire order', () => {
    expect(MAINTENANCE_TASKS).toEqual([
      'purge_login_attempts',
      'verify_chain',
      'node_health',
      'metrics_rollup',
      'threat_level',
      'expire_invitations',
      'flag_dormant_accounts',
      'audit_snapshot',
      'scheduled_publish',
      'stale_signups',
      'outbox_reenqueue',
      'media_scan',
    ]);
  });

  it('accepts every task name and rejects anything else', () => {
    for (const task of MAINTENANCE_TASKS) {
      expect(MaintenanceJobPayload.safeParse({ task }).success, task).toBe(true);
    }
    expect(MaintenanceJobPayload.safeParse({ task: 'rm_rf' }).success).toBe(false);
    expect(MaintenanceJobPayload.safeParse({}).success).toBe(false);
  });
});

describe('queue registry', () => {
  it('has a payload schema for every queue name', () => {
    expect(QUEUE_NAME_VALUES).toEqual(['scan', 'broadcast', 'maintenance', 'pdf', 'notify']);
    for (const name of QUEUE_NAME_VALUES) {
      expect(QUEUE_PAYLOADS[name], name).toBeDefined();
    }
  });
});
