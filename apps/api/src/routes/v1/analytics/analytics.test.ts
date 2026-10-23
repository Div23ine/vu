import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import analyticsRoutes from './index';
import type { SqlExecutor } from '../../../audit/repo';

/**
 * Analytics intake tests: the event vocabulary is closed, the payload lands
 * in the executor as (event, meta) and nothing identifiable is accepted.
 */

function harness() {
  const inserts: Array<{ event: string; meta: string }> = [];
  const executor: SqlExecutor = {
    unsafe: (async (sqlText: string, params?: unknown[]) => {
      if (String(sqlText).includes('insert into analytics_events')) {
        inserts.push({ event: String(params?.[0]), meta: String(params?.[1]) });
      }
      return [];
    }) as SqlExecutor['unsafe'],
  };
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(analyticsRoutes, { executor });
  return { app, inserts };
}

describe('POST /analytics (mounted at /api/v1/analytics)', () => {
  it('stores a consented event with its meta', async () => {
    const { app, inserts } = harness();
    const response = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'tier_click', meta: { plan: 'starter_scan' } },
    });
    expect(response.statusCode).toBe(202);
    expect(inserts).toEqual([{ event: 'tier_click', meta: '{"plan":"starter_scan"}' }]);
  });

  it('refuses event names outside the closed vocabulary', async () => {
    const { app, inserts } = harness();
    const response = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'page_view_everything' },
    });
    expect(response.statusCode).toBe(400);
    expect(inserts).toHaveLength(0);
  });
});
