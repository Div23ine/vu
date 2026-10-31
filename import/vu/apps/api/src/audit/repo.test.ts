import { describe, expect, it, vi } from 'vitest';
import { asExecutor } from './repo.js';

describe('asExecutor date safety', () => {
  it('stringifies Date parameters before they reach the driver', async () => {
    const unsafe = vi.fn(async () => [] as unknown[]);
    const executor = asExecutor({ unsafe });
    const at = new Date('2026-10-17T00:00:00Z');
    await executor.unsafe('update t set seen_at = $2 where id = $1', ['id', at]);
    expect(unsafe).toHaveBeenCalledWith('update t set seen_at = $2 where id = $1', [
      'id',
      at.toISOString(),
    ]);
  });

  it('stringifies dates nested in array parameters', async () => {
    const unsafe = vi.fn(async () => [] as unknown[]);
    const executor = asExecutor({ unsafe });
    const at = new Date('2026-10-17T00:00:00Z');
    await executor.unsafe('select $1', [[at, 'x']]);
    expect(unsafe).toHaveBeenCalledWith('select $1', [[at.toISOString(), 'x']]);
  });
});
