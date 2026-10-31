import { describe, expect, it } from 'vitest';
import { SLOT_LEASE_SECONDS, createMemorySlotSemaphore, createSlotSemaphore } from './slots';

/**
 * Slot-semaphore tests (Task 84).
 *
 * The two properties that matter: the ceiling is never exceeded, and a release
 * always gives the capacity back — a leaked slot permanently shrinks the
 * cluster. The TTL is asserted too, because it is the only thing that recovers
 * capacity from a controller that dies mid-scan.
 */

interface FakeRedis {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  value(key: string): number;
  expiries: { key: string; seconds: number }[];
}

function fakeRedis(): FakeRedis {
  const store = new Map<string, number>();
  const expiries: { key: string; seconds: number }[] = [];
  return {
    async incr(key) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async decr(key) {
      const next = (store.get(key) ?? 0) - 1;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      expiries.push({ key, seconds });
      return 1;
    },
    value(key) {
      return store.get(key) ?? 0;
    },
    expiries,
  };
}

describe('createSlotSemaphore', () => {
  it('admits up to the ceiling and refuses the next acquire', async () => {
    const redis = fakeRedis();
    const slots = createSlotSemaphore({ redis, total: 2 });

    expect(await slots.acquire()).toBe(true);
    expect(await slots.acquire()).toBe(true);
    expect(await slots.acquire()).toBe(false);
    expect(redis.value('scan:slots')).toBe(2);
  });

  it('gives the slot straight back when the ceiling is reached', async () => {
    const redis = fakeRedis();
    const slots = createSlotSemaphore({ redis, total: 1 });

    expect(await slots.acquire()).toBe(true);
    expect(await slots.acquire()).toBe(false);
    // The refused acquire must not have left the counter inflated.
    expect(redis.value('scan:slots')).toBe(1);

    await slots.release();
    expect(redis.value('scan:slots')).toBe(0);
    expect(await slots.acquire()).toBe(true);
  });

  it('refreshes a 20-minute lease on every acquire and release', async () => {
    const redis = fakeRedis();
    const slots = createSlotSemaphore({ redis, total: 4 });

    await slots.acquire();
    await slots.release();

    expect(redis.expiries.length).toBeGreaterThanOrEqual(2);
    for (const entry of redis.expiries) {
      expect(entry.key).toBe('scan:slots');
      expect(entry.seconds).toBe(SLOT_LEASE_SECONDS);
    }
    expect(SLOT_LEASE_SECONDS).toBe(20 * 60);
  });

  it('honours a custom key', async () => {
    const redis = fakeRedis();
    const slots = createSlotSemaphore({ redis, total: 1, key: 'custom:slots' });

    await slots.acquire();
    expect(redis.value('custom:slots')).toBe(1);
    expect(redis.value('scan:slots')).toBe(0);
  });

  it('clamps a double release so the ceiling cannot drift upward', async () => {
    const redis = fakeRedis();
    const slots = createSlotSemaphore({ redis, total: 1 });

    // A release without a matching acquire must not create extra capacity.
    await slots.release();
    expect(redis.value('scan:slots')).toBe(0);
    expect(await slots.acquire()).toBe(true);
    // Still exactly one slot in existence.
    expect(await slots.acquire()).toBe(false);
  });
});

describe('createMemorySlotSemaphore', () => {
  it('behaves like the Redis one for a single process', async () => {
    const slots = createMemorySlotSemaphore(1);

    expect(await slots.acquire()).toBe(true);
    expect(await slots.acquire()).toBe(false);
    await slots.release();
    expect(await slots.acquire()).toBe(true);
  });

  it('never goes negative on an extra release', async () => {
    const slots = createMemorySlotSemaphore(1);

    await slots.release();
    expect(await slots.acquire()).toBe(true);
    expect(await slots.acquire()).toBe(false);
  });
});
