import type { SlotSemaphore } from '../ports';

/**
 * Worker-slot semaphore (Task 84) — a Redis counter that caps how many pods this
 * controller runs at once.
 *
 * The count lives in Redis rather than in process memory because more than one
 * controller replica may consume the same queue, and the ceiling is a property
 * of the cluster (node capacity), not of a process.
 *
 * Two rules make it safe:
 *  - **Reject, never wait.** `acquire()` returns false at the ceiling and the
 *    caller requeues the job. A worker that blocked on a slot would hold its
 *    BullMQ lock while doing nothing and starve the queue.
 *  - **The key expires.** Every acquire refreshes a 20-minute TTL, so a
 *    controller that dies mid-scan cannot leak slots forever — the counter
 *    drains itself. The TTL is longer than the 900 s pod deadline on purpose.
 *
 * `INCR` then compare-and-`DECR` is atomic enough for this use: the increment
 * itself is the reservation, so two concurrent acquires can never both believe
 * they took the same slot.
 */

/** Longer than the 900 s pod deadline, so a live scan never loses its slot. */
export const SLOT_LEASE_SECONDS = 20 * 60;

/** The Redis commands the semaphore needs — trivially fakeable in tests. */
export interface SlotRedis {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface SlotOptions {
  redis: SlotRedis;
  total: number;
  /** Defaults to `scan:slots`. */
  key?: string;
  leaseSeconds?: number;
}

export function createSlotSemaphore(options: SlotOptions): SlotSemaphore {
  const key = options.key ?? 'scan:slots';
  const lease = options.leaseSeconds ?? SLOT_LEASE_SECONDS;

  return {
    async acquire(): Promise<boolean> {
      const held = await options.redis.incr(key);
      // Refresh the leak guard on every reservation.
      await options.redis.expire(key, lease);
      if (held > options.total) {
        // Give the slot straight back; we never held it.
        await options.redis.decr(key);
        return false;
      }
      return true;
    },

    async release(): Promise<void> {
      const remaining = await options.redis.decr(key);
      // A negative count means a double release or an expired lease; clamp it so
      // the ceiling cannot drift upward and admit extra pods.
      if (remaining < 0) await options.redis.incr(key);
      await options.redis.expire(key, lease);
    },
  };
}

/** An in-memory semaphore for local runs and tests (no Redis required). */
export function createMemorySlotSemaphore(total: number): SlotSemaphore {
  let held = 0;
  return {
    async acquire(): Promise<boolean> {
      if (held >= total) return false;
      held += 1;
      return true;
    },
    async release(): Promise<void> {
      held = Math.max(0, held - 1);
    },
  };
}
