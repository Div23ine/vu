// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicContent } from '@vunvault/contracts/fixtures/store';
import { createQueryClient } from '@vunvault/lib';
import { AttackSurface } from './attack-surface';
import { InsightsGrid } from './insights-grid';
import { Segments } from './segments';

/**
 * Home mid-page tests (Task 49).
 *
 * The grid runs against the MSW public-content handler (the six fixture
 * posts, newest first), so the rotation assertions derive their expected
 * titles from the same fixtures the mock serves. `next/image` is mocked to a
 * plain `img`: the fixture artwork lives on a `.test` CDN host that the
 * optimiser is not configured for outside a Next runtime, and the card's job
 * here is data behaviour, not image loading.
 */

vi.mock('next/image', () => ({
  // The stub is the point: a plain <img> stands in for the optimiser, which
  // has no Next runtime (and no configured remote host) inside Vitest.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const SORTED = [...publicContent].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

const originalMatchMedia = window.matchMedia;

function stubReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: ((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia,
  });
}

function renderGrid() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <InsightsGrid />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe('AttackSurface', () => {
  it('renders the three numbered steps verbatim', () => {
    render(<AttackSurface />);
    expect(screen.getByText('ATTACK SURFACE MAPPING')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Every login page, API and subdomain is a door. We map them all.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Domains, subdomains and exposed services are enumerated and scored by exposure.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Each node is cross-referenced against known CVEs and misconfiguration patterns.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(
      screen.getByText('You receive a prioritized map — not a 40-page PDF nobody reads.'),
    ).toBeInTheDocument();
  });
});

describe('Segments', () => {
  it('renders the four organisation cards with their routes', () => {
    render(<Segments />);
    expect(screen.getByRole('heading', { name: 'How Can VUNVAULT Help You?' })).toBeInTheDocument();

    const expected = [
      ['I run a Small Business', '/services#pricing'],
      ['I’m in a SACCO or Fintech', '/services#pricing'],
      ['I’m in IT / Enterprise', '/services#pricing'],
      ['I run a SOC / Security Team', '/services'],
    ] as const;
    for (const [title, href] of expected) {
      const heading = screen.getByRole('heading', { name: title });
      expect(heading.closest('a')).toHaveAttribute('href', href);
    }
    expect(screen.getByText('Starter Scan')).toBeInTheDocument();
    expect(screen.getByText('Compliance Ready')).toBeInTheDocument();
    expect(screen.getByText('Retainer Protection')).toBeInTheDocument();
    expect(screen.getByText('Purple Team')).toBeInTheDocument();
  });
});

describe('InsightsGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders the three newest cards with links to /blog/<slug>', async () => {
    renderGrid();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    const first = SORTED[0];
    const second = SORTED[1];
    const third = SORTED[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected at least three fixture posts.');
    }
    for (const item of [first, second, third]) {
      const title = screen.getByText(item.title);
      expect(title.closest('a')).toHaveAttribute('href', item.slugPath);
      expect(item.slugPath).toMatch(/^\/blog\//);
    }
    const fourth = SORTED[3];
    if (fourth !== undefined) expect(screen.queryByText(fourth.title)).toBeNull();
  });

  it('rotates the visible window by one position every 4s (6 fixture posts)', async () => {
    renderGrid();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const first = SORTED[0];
    const fourth = SORTED[3];
    if (first === undefined || fourth === undefined) throw new Error('Need six fixture posts.');
    expect(screen.getByText(first.title)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByText(first.title)).toBeNull();
    expect(screen.getByText(fourth.title)).toBeInTheDocument();

    // The entering animation is applied on rotation (staggered per card).
    const entering = document.querySelectorAll('.vv-article-card.is-news-entering');
    expect(entering).toHaveLength(3);
  });

  it('does not rotate under prefers-reduced-motion', async () => {
    stubReducedMotion(true);
    renderGrid();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const first = SORTED[0];
    if (first === undefined) throw new Error('Need fixture posts.');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText(first.title)).toBeInTheDocument();
    expect(document.querySelectorAll('.is-news-entering')).toHaveLength(0);
  });

  it('shows the section furniture verbatim', async () => {
    renderGrid();
    expect(screen.getByText('Latest Insights & Intelligence')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'From the VUNVAULT News & Blog' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore all news & reports/ })).toHaveAttribute(
      'href',
      '/blog',
    );
    // Loading state: skeletons + aria-busy until the query resolves.
    const grid = document.getElementById('vv-news-grid');
    expect(grid).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(grid).toHaveAttribute('aria-busy', 'false');
    // 3 article card links + the "Explore all news & reports" link.
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});
