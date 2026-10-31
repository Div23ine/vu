import type { Permission, ReviewDecision } from '@vunvault/contracts';
import type { ReviewCheckKey, ReviewGateState, ScanStatus } from '@vunvault/db/enum-values';
import { REVIEW_CHECK_KEYS } from '@vunvault/db/enum-values';

/**
 * The Mandatory Admin Review Gate, as pure rules.
 *
 * Nothing in this module reads a database, calls a provider or throws an HTTP
 * error. It answers two questions — "may this job be decided?" and "what does
 * this decision do to the row?" — so the whole gate can be tested against every
 * combination of status, payment state, permission and checklist without a
 * harness. The service maps the answers onto statuses and codes.
 *
 * The two locks that matter:
 *
 *  - PAYMENT LOCK. An approval on an unpaid job does NOT release. It records the
 *    decision, moves the gate to `blocked_payment`, and the caller answers 409.
 *    The reviewer's work is not thrown away; the report is not handed over.
 *  - RELEASE IS FINAL. Nothing here can move a job out of `approved_released`,
 *    and there is no delete. Retracting a report means issuing a new job.
 */

/** A job can only be decided once the scanner has finished with it. */
export const DECIDABLE_STATUS: ScanStatus = 'completed';

/** The permission that actually releases a report to a client. */
export const RELEASE_PERMISSION: Permission = 'scans:release';

/** The permission needed to hold or reject. */
export const REVIEW_PERMISSION: Permission = 'scans:review';

/** A reviewer must say why. Ten characters is the floor. */
export const MIN_NOTE_LENGTH = 10;

export type GateOutcome = 'released' | 'blocked_payment' | 'held' | 'rejected';

export interface GateJobRow {
  id: string;
  status: ScanStatus;
  reviewGateState: ReviewGateState;
  paymentStatus: string;
  releasedAt: string | Date | null;
}

export interface GateDecisionInput {
  job: GateJobRow;
  decision: ReviewDecision;
  checks: Record<ReviewCheckKey, boolean>;
  note: string;
  actorId: string;
  actorRole: string;
  actorPermissions: Permission[];
  now?: Date;
}

export interface GateDecisionResult {
  /** The columns to write. Never includes a deletion or an un-release. */
  next: {
    reviewGateState: ReviewGateState;
    status?: ScanStatus;
    releasedAt?: Date;
    releasedBy?: string;
  };
  outcome: GateOutcome;
}

export interface ReviewGateRules {
  canDecide(job: { status: ScanStatus }): boolean;
  decide(input: GateDecisionInput): GateDecisionResult;
}

/** True once the report has left the building. */
export function isReleased(job: {
  reviewGateState: ReviewGateState;
  releasedAt: unknown;
}): boolean {
  return job.reviewGateState === 'approved_released' || job.releasedAt !== null;
}

/** Only a finished scan can be reviewed: there is nothing to read before then. */
export function canDecide(job: { status: ScanStatus }): boolean {
  return job.status === DECIDABLE_STATUS;
}

/** Releasing needs `scans:release`; holding or rejecting needs `scans:review`. */
export function permissionFor(decision: ReviewDecision): Permission {
  return decision === 'approve_release' ? RELEASE_PERMISSION : REVIEW_PERMISSION;
}

export function mayDecide(decision: ReviewDecision, permissions: Permission[]): boolean {
  return permissions.includes(permissionFor(decision));
}

/** All five checks, every one of them, must be true to release. */
export function allChecksPassed(checks: Record<ReviewCheckKey, boolean>): boolean {
  return REVIEW_CHECK_KEYS.every((key) => checks[key] === true);
}

export function failingChecks(checks: Record<ReviewCheckKey, boolean>): ReviewCheckKey[] {
  return REVIEW_CHECK_KEYS.filter((key) => checks[key] !== true);
}

export function noteIsLongEnough(note: string): boolean {
  return note.trim().length >= MIN_NOTE_LENGTH;
}

/** The gate state each decision moves a job to, payment aside. */
export function gateStateFor(decision: ReviewDecision): ReviewGateState {
  switch (decision) {
    case 'approve_release':
      return 'approved_released';
    case 'hold_remediation':
    case 'reject_archive':
      return 'held_blocked';
  }
}

export function statusFor(decision: ReviewDecision): ScanStatus | undefined {
  switch (decision) {
    case 'approve_release':
      // The scan is still `completed`: the gate state is what carries the release.
      return undefined;
    case 'hold_remediation':
      return 'held';
    case 'reject_archive':
      return 'rejected';
  }
}

/**
 * Apply a decision to a row.
 *
 * The caller has already established that the job is decidable, that the actor
 * holds the right permission, that the note is long enough and that a release has
 * all five checks. What is left is the payment lock, which is a property of the
 * job and not of the actor: an approval on an unpaid job becomes `blocked_payment`
 * here, and the service turns that into a 409 while still committing the decision.
 */
export function decide(input: GateDecisionInput): GateDecisionResult {
  const now = input.now ?? new Date();

  if (input.decision !== 'approve_release') {
    return {
      next: {
        reviewGateState: gateStateFor(input.decision),
        status: statusFor(input.decision),
      },
      outcome: input.decision === 'hold_remediation' ? 'held' : 'rejected',
    };
  }

  if (input.job.paymentStatus !== 'paid') {
    return {
      next: { reviewGateState: 'blocked_payment' },
      outcome: 'blocked_payment',
    };
  }

  return {
    next: {
      reviewGateState: 'approved_released',
      releasedAt: now,
      releasedBy: input.actorId,
    },
    outcome: 'released',
  };
}

/** The rules object, for callers that would rather inject them than import them. */
export const reviewGate: ReviewGateRules = { canDecide, decide };

/**
 * Which jobs a bulk action may touch. Bulk can open a gate, assign a reviewer,
 * hold or reject — it can NEVER release, which is why `approve_release` is not a
 * bulk action and no bulk path sets `released_at`.
 */
export function isEligibleForBulk(
  job: { status: ScanStatus; reviewGateState: ReviewGateState },
  action: 'open_review_gate' | 'assign_reviewer' | 'place_on_hold' | 'reject_batch',
): boolean {
  const released = job.reviewGateState === 'approved_released';
  switch (action) {
    case 'open_review_gate':
      // A finished scan that nobody has looked at yet.
      return job.status === 'completed' && job.reviewGateState === 'not_eligible';
    case 'assign_reviewer':
      return !released && job.status !== 'cancelled' && job.status !== 'rejected';
    case 'place_on_hold':
      return !released && job.status !== 'cancelled' && job.status !== 'rejected';
    case 'reject_batch':
      return !released && job.status !== 'cancelled';
  }
}
