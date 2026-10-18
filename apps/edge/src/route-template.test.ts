import { describe, expect, it } from 'vitest';
import { MAX_TEMPLATE_LENGTH, routeTemplate } from './route-template.js';

describe('routeTemplate', () => {
  it('collapses uuids, long hex, numbers and tokens', () => {
    expect(routeTemplate('/api/v1/scans/6f1c0a2e-9d4a-4e7b-8c2f-1a5d6e7f8090/stream')).toBe(
      '/api/v1/scans/:id/stream',
    );
    expect(routeTemplate('/api/v1/invitations/tKn9x2LmQ7vR4pW8zB1cY6dF3gH5jA0sEuI2oXn')).toBe(
      '/api/v1/invitations/:token',
    );
    expect(routeTemplate('/api/v1/billing/invoices/123')).toBe('/api/v1/billing/invoices/:id');
    expect(routeTemplate('/api/v1/reports/abcdef0123456789abcdef')).toBe('/api/v1/reports/:id');
  });

  it('keeps static segments and strips the query', () => {
    expect(routeTemplate('/api/v1/admin/audit?page=2&q=login#frag')).toBe('/api/v1/admin/audit');
    expect(routeTemplate('/healthz')).toBe('/healthz');
  });

  it('never exceeds the cap', () => {
    const long = `/api/v1/${'segment/'.repeat(30)}end`;
    expect(routeTemplate(long).length).toBeLessThanOrEqual(MAX_TEMPLATE_LENGTH);
  });
});
