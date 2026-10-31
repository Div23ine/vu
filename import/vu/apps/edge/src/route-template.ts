/**
 * Route templates for Analytics Engine (Task 99).
 *
 * The dataset is grouped by blob1, so a raw path would explode its
 * cardinality — one series per scan id, per invoice number, per token. Every
 * identifier-shaped segment collapses to `:id` or `:token` instead, which is
 * what makes the maintenance worker's rollup (Task 91) a GROUP BY rather than
 * a memory leak.
 */

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_SEGMENT = /^[0-9a-f]{16,}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{24,}$/;

/** Templates longer than this are truncated — a blob has to stay groupable. */
export const MAX_TEMPLATE_LENGTH = 80;

export function routeTemplate(path: string): string {
  const pathname = path.split('?')[0] ?? '';
  const segments = pathname.split('/').map((segment) => {
    if (segment === '') return segment;
    if (UUID_SEGMENT.test(segment)) return ':id';
    if (LONG_HEX_SEGMENT.test(segment)) return ':id';
    if (NUMERIC_SEGMENT.test(segment)) return ':id';
    if (TOKEN_SEGMENT.test(segment)) return ':token';
    return segment;
  });
  return segments.join('/').slice(0, MAX_TEMPLATE_LENGTH);
}
