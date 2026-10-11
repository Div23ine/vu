import { SECURITY_POSTURE_ITEMS, postureScore } from '@vunvault/contracts';
import type { SecurityPosture } from '@vunvault/contracts';

/**
 * Security posture.
 *
 * The score is `round(100 × done ÷ total)` — the formula, not the prototype's
 * hand-written 80 for "3 of 4". Labels are the contract's verbatim copy, in the
 * contract's order.
 */

export const POSTURE_ITEM_IDS = [
  'hardware_key',
  'recovery_codes',
  'password_age',
  'backup_key',
] as const;

export type PostureItemId = (typeof POSTURE_ITEM_IDS)[number];

/** A password older than this counts as stale. */
export const PASSWORD_MAX_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PostureInput {
  webauthnKeyCount: number;
  recoveryBatchExists: boolean;
  lastPasswordChangeAt: Date | string | null;
  now?: Date;
}

export function postureItemDone(id: PostureItemId, input: PostureInput, now: Date): boolean {
  switch (id) {
    case 'hardware_key':
      return input.webauthnKeyCount >= 1;
    case 'recovery_codes':
      return input.recoveryBatchExists;
    case 'password_age': {
      if (input.lastPasswordChangeAt === null) return false;
      const changedAt =
        typeof input.lastPasswordChangeAt === 'string'
          ? new Date(input.lastPasswordChangeAt)
          : input.lastPasswordChangeAt;
      if (Number.isNaN(changedAt.getTime())) return false;
      return now.getTime() - changedAt.getTime() <= PASSWORD_MAX_AGE_DAYS * DAY_MS;
    }
    case 'backup_key':
      return input.webauthnKeyCount >= 2;
    default:
      return false;
  }
}

export function computePosture(input: PostureInput): SecurityPosture {
  const now = input.now ?? new Date();
  const items = POSTURE_ITEM_IDS.map((id, index) => ({
    id,
    label: SECURITY_POSTURE_ITEMS[index] as string,
    done: postureItemDone(id, input, now),
  }));

  const completed = items.filter((item) => item.done).length;
  const total = items.length;
  const score = postureScore(completed, total);

  return {
    score,
    label: score >= 75 ? 'Strong posture' : score >= 40 ? 'Fair posture' : 'Weak posture',
    completed,
    total,
    items,
  };
}
