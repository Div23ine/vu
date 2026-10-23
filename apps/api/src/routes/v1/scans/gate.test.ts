import { describe, expect, it } from 'vitest';
import type { Permission } from '@vunvault/contracts';
import { REVIEW_CHECK_KEYS, type ReviewCheckKey } from '@vunvault/db/enum-values';
import {
  allChecksPassed,
  canDecide,
  DECIDABLE_STATUS,
  decide,
  failingChecks,
  gateStateFor,
  isEligibleForBulk,
  isReleased,
  mayDecide,
  MIN_NOTE_LENGTH,
  noteIsLongEnough,
  permissionFor,
  RELEASE_PERMISSION,
  REVIEW_PERMISSION,
  statusFor,
  type GateDecisionInput,
  type GateJobRow,
} from './gate';

/**
 * The gate as pure rules: every combination of status, payment state, permission
 * and checklist, without a harness. These are the rules a penetration-test report
 * has to pass before a customer sees it, so they are tested exhaustively rather
 * than through happy paths.
 */

const NOTE = 'Findings validated with the client, evidence sanitised.';

function allChecks(passed = true): Record<ReviewCheckKey, boolean> {
  return Object.fromEntries(REVIEW_CHECK_KEYS.map((key) => [key, passed])) as Record<
    ReviewCheckKey,
    boolean
  >;
}

function job(overrides: Partial<GateJobRow> = {}): GateJobRow {
  return {
    id: 'b1000000-0000-4000-8000-0000000000b1',
    status: 'completed',
    reviewGateState: 'in_review',
    paymentStatus: 'paid',
    releasedAt: null,
    ...overrides,
  };
}

function input(overrides: Partial<GateDecisionInput> = {}): GateDecisionInput {
  return {
    job: job(),
    decision: 'approve_release',
    checks: allChecks(),
    note: NOTE,
    actorId: 'c1000000-0000-4000-8000-0000000000a1',
    actorRole: 'admin',
    actorPermissions: ['scans:review', 'scans:release'] as Permission[],
    now: new Date('2026-10-06T12:00:00.000Z'),
    ...overrides,
  };
}

describe('canDecide', () => {
  it('allows a decision only once the scanner has finished', () => {
    expect(DECIDABLE_STATUS).toBe('completed');
    expect(canDecide({ status: 'completed' })).toBe(true);
    for (const status of [
      'queued',
      'running',
      'awaiting_review',
      'held',
      'rejected',
      'cancelled',
    ] as const) {
      expect(canDecide({ status }), status).toBe(false);
    }
  });
});

describe('permissions', () => {
  it('separates releasing from reviewing', () => {
    expect(permissionFor('approve_release')).toBe(RELEASE_PERMISSION);
    expect(permissionFor('hold_remediation')).toBe(REVIEW_PERMISSION);
    expect(permissionFor('reject_archive')).toBe(REVIEW_PERMISSION);
  });

  it('refuses an analyst who can review but not release', () => {
    const analyst = ['scans:read', 'scans:review'] as Permission[];
    expect(mayDecide('hold_remediation', analyst)).toBe(true);
    expect(mayDecide('reject_archive', analyst)).toBe(true);
    expect(mayDecide('approve_release', analyst)).toBe(false);
  });

  it('allows an admin to release', () => {
    const admin = ['scans:review', 'scans:release'] as Permission[];
    expect(mayDecide('approve_release', admin)).toBe(true);
  });

  it('refuses everyone with no scan permissions at all', () => {
    expect(mayDecide('approve_release', [])).toBe(false);
    expect(mayDecide('hold_remediation', [])).toBe(false);
  });
});

describe('the checklist and the note', () => {
  it('needs all five checks, and names the ones that failed', () => {
    expect(REVIEW_CHECK_KEYS).toHaveLength(5);
    expect(allChecksPassed(allChecks())).toBe(true);
    expect(failingChecks(allChecks())).toEqual([]);

    for (const key of REVIEW_CHECK_KEYS) {
      const checks = { ...allChecks(), [key]: false };
      expect(allChecksPassed(checks), key).toBe(false);
      expect(failingChecks(checks), key).toEqual([key]);
    }
  });

  it('treats a missing check as failed', () => {
    const partial = Object.fromEntries(
      REVIEW_CHECK_KEYS.filter((key) => key !== 'client_redaction_approved').map((key) => [
        key,
        true,
      ]),
    ) as Record<ReviewCheckKey, boolean>;
    expect(allChecksPassed(partial)).toBe(false);
    expect(failingChecks(partial)).toEqual(['client_redaction_approved']);
  });

  it('enforces the ten-character floor on a reviewer note', () => {
    expect(MIN_NOTE_LENGTH).toBe(10);
    expect(noteIsLongEnough('nine char')).toBe(false);
    expect(noteIsLongEnough('ten chars!')).toBe(true);
    // Whitespace is not a reason.
    expect(noteIsLongEnough('          x')).toBe(false);
  });
});

describe('decide', () => {
  it('releases a paid job with all five checks', () => {
    const result = decide(input());
    expect(result.outcome).toBe('released');
    expect(result.next).toEqual({
      reviewGateState: 'approved_released',
      releasedAt: new Date('2026-10-06T12:00:00.000Z'),
      releasedBy: 'c1000000-0000-4000-8000-0000000000a1',
    });
    // The scan stays `completed`: the gate state carries the release.
    expect(result.next.status).toBeUndefined();
  });

  it('blocks the release of an unpaid job and says so', () => {
    for (const paymentStatus of ['pending', 'overdue']) {
      const result = decide(input({ job: job({ paymentStatus }) }));
      expect(result.outcome, paymentStatus).toBe('blocked_payment');
      expect(result.next, paymentStatus).toEqual({ reviewGateState: 'blocked_payment' });
      // No release, ever, without payment.
      expect(result.next.releasedAt, paymentStatus).toBeUndefined();
      expect(result.next.releasedBy, paymentStatus).toBeUndefined();
    }
  });

  it('holds a job for remediation', () => {
    const result = decide(input({ decision: 'hold_remediation' }));
    expect(result.outcome).toBe('held');
    expect(result.next).toEqual({ reviewGateState: 'held_blocked', status: 'held' });
  });

  it('rejects and archives a job', () => {
    const result = decide(input({ decision: 'reject_archive' }));
    expect(result.outcome).toBe('rejected');
    expect(result.next).toEqual({ reviewGateState: 'held_blocked', status: 'rejected' });
  });

  it('holds and rejects an unpaid job the same way it holds a paid one', () => {
    // The payment lock only gates a RELEASE.
    const unpaid = job({ paymentStatus: 'overdue' });
    expect(decide(input({ job: unpaid, decision: 'hold_remediation' })).outcome).toBe('held');
    expect(decide(input({ job: unpaid, decision: 'reject_archive' })).outcome).toBe('rejected');
  });

  it('maps every decision onto exactly one gate state', () => {
    expect(gateStateFor('approve_release')).toBe('approved_released');
    expect(gateStateFor('hold_remediation')).toBe('held_blocked');
    expect(gateStateFor('reject_archive')).toBe('held_blocked');
    expect(statusFor('hold_remediation')).toBe('held');
    expect(statusFor('reject_archive')).toBe('rejected');
    expect(statusFor('approve_release')).toBeUndefined();
  });
});

describe('release is final', () => {
  it('recognises a released job by its gate state or its timestamp', () => {
    expect(isReleased(job({ reviewGateState: 'approved_released' }))).toBe(true);
    expect(isReleased(job({ releasedAt: '2026-10-01T00:00:00.000Z' }))).toBe(true);
    expect(isReleased(job())).toBe(false);
  });

  it('never produces a transition out of approved_released', () => {
    // Every outcome of `decide` is enumerated: none of them un-releases.
    const outcomes = (['approve_release', 'hold_remediation', 'reject_archive'] as const).flatMap(
      (decision) =>
        ['paid', 'pending', 'overdue'].map((paymentStatus) =>
          decide(input({ decision, job: job({ paymentStatus }) })),
        ),
    );
    for (const outcome of outcomes) {
      expect(outcome.next.reviewGateState).not.toBe('not_eligible');
      expect(outcome.next.reviewGateState).not.toBe('in_review');
    }
    expect(new Set(outcomes.map((outcome) => outcome.outcome))).toEqual(
      new Set(['released', 'blocked_payment', 'held', 'rejected']),
    );
  });
});

describe('bulk eligibility', () => {
  it('opens the gate only for a finished job nobody has reviewed', () => {
    expect(isEligibleForBulk(job({ reviewGateState: 'not_eligible' }), 'open_review_gate')).toBe(
      true,
    );
    expect(isEligibleForBulk(job({ reviewGateState: 'in_review' }), 'open_review_gate')).toBe(
      false,
    );
    expect(isEligibleForBulk(job({ status: 'running' }), 'open_review_gate')).toBe(false);
    expect(
      isEligibleForBulk(
        job({ status: 'completed', reviewGateState: 'approved_released' }),
        'open_review_gate',
      ),
    ).toBe(false);
  });

  it('never touches a released job', () => {
    const released = job({ reviewGateState: 'approved_released' });
    for (const action of ['assign_reviewer', 'place_on_hold', 'reject_batch'] as const) {
      expect(isEligibleForBulk(released, action), action).toBe(false);
    }
  });

  it('skips cancelled and rejected rows for hold and assignment', () => {
    expect(isEligibleForBulk(job({ status: 'cancelled' }), 'place_on_hold')).toBe(false);
    expect(isEligibleForBulk(job({ status: 'rejected' }), 'place_on_hold')).toBe(false);
    expect(isEligibleForBulk(job({ status: 'cancelled' }), 'assign_reviewer')).toBe(false);
    expect(isEligibleForBulk(job({ status: 'rejected' }), 'assign_reviewer')).toBe(false);
    expect(isEligibleForBulk(job({ status: 'queued' }), 'assign_reviewer')).toBe(true);
  });

  it('rejects anything that is not already cancelled', () => {
    expect(isEligibleForBulk(job({ status: 'completed' }), 'reject_batch')).toBe(true);
    expect(isEligibleForBulk(job({ status: 'cancelled' }), 'reject_batch')).toBe(false);
  });
});
