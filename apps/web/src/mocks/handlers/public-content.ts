import { http, HttpResponse } from 'msw';
import {
  PublicContentDetail,
  PublicContentItem,
  type PublicContentItem as PublicContentItemType,
} from '@vunvault/contracts';
import { publicContent } from '@vunvault/contracts/fixtures/store';

/**
 * Public content mock handlers (an earlier iteration, extended by an earlier iteration).
 *
 * Serves the fixture posts through the real query contract:
 * GET /api/v1/content?q=&category=&sort=&page=&pageSize= → 200 { data, total }
 * GET /api/v1/content/:slug → 200 { data: PublicContentDetail } | 404
 *
 * `q` mirrors the API repo's semantics (case-insensitive substring over
 * title, excerpt and tags); `sort=newest` orders by `publishedAt` descending;
 * `sort=priority` is severity critical→low, then newest. Responses are
 * validated against the contract schemas before they leave, so fixture drift
 * fails loudly instead of poisoning a test.
 *
 * The fixtures carry no `bodyMd` (the real one lives in the database's
 * `body_md` column), so the detail route synthesises a deterministic
 * markdown body per item — mock scaffolding for the SafeMarkdown renderer,
 * clearly labelled as such, never UI copy.
 */

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortItems(items: PublicContentItemType[], sort: string | null): PublicContentItemType[] {
  const copied = [...items];
  if (sort === 'priority') {
    copied.sort((a, b) => {
      const left = a.severity === null ? 99 : (SEVERITY_RANK[a.severity] ?? 98);
      const right = b.severity === null ? 99 : (SEVERITY_RANK[b.severity] ?? 98);
      if (left !== right) return left - right;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
    return copied;
  }
  copied.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return copied;
}

function matchesQuery(item: PublicContentItemType, q: string): boolean {
  const needle = q.toLowerCase();
  if (item.title.toLowerCase().includes(needle)) return true;
  if (item.excerpt !== null && item.excerpt.toLowerCase().includes(needle)) return true;
  return item.tags.some((tag) => tag.toLowerCase().includes(needle));
}

/** Deterministic mock article body (see file header). */
function synthesiseBody(item: PublicContentItemType): string {
  return [
    '## Overview',
    '',
    item.excerpt ?? item.title,
    '',
    '### Field notes',
    '',
    `- Mock body for "${item.title}" — the fixtures carry no article text.`,
    '- The real `body_md` is served by the API and stored sanitised .',
    '- Rendered through `SafeMarkdown`: no raw HTML, no images, safe links only.',
    '',
    '> Advisories are published after vendor coordination completes.',
    '',
    'Closure reference: `' + item.slug + '`',
  ].join('\n');
}

export const publicContentHandlers = [
  http.get('*/api/v1/content/:slug', ({ params }) => {
    const slug = String(params.slug);
    const item = publicContent.find((candidate) => candidate.slug === slug);
    if (item === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const detail = { ...item, bodyMd: synthesiseBody(item) };
    const parsed = PublicContentDetail.safeParse(detail);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'fixture_drift', details: parsed.error.issues },
        { status: 500 },
      );
    }
    return HttpResponse.json({ data: parsed.data });
  }),

  http.get('*/api/v1/content', ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? '20');
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20;
    const q = url.searchParams.get('q') ?? '';
    const category = url.searchParams.get('category');

    let items = sortItems(publicContent, url.searchParams.get('sort'));
    if (q !== '') items = items.filter((item) => matchesQuery(item, q));
    if (category !== null && category !== '') {
      items = items.filter((item) => item.category === category);
    }

    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);

    for (const item of data) {
      const parsed = PublicContentItem.safeParse(item);
      if (!parsed.success) {
        return HttpResponse.json(
          { error: 'fixture_drift', details: parsed.error.issues },
          { status: 500 },
        );
      }
    }
    return HttpResponse.json({ data, total: items.length });
  }),
];
