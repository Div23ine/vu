// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { publicContent } from '@vunvault/contracts/fixtures/store';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import BlogPage from './page';

vi.mock('next/image', () => ({
  // The stub is the point: a plain <img> stands in for the optimiser, which
  // has no Next runtime (and no configured remote host) inside Vitest.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

/**
 * Blog list tests (Task 56).
 *
 * Everything runs against the MSW public-content handler (the six fixture
 * posts), so search/category assertions verify the REAL request pipeline:
 * the 250 ms debounce, the `q` / `category` query params and the mock's
 * ILIKE-style filtering. `next/image` is stubbed (the fixture artwork lives
 * on a `.test` CDN host the optimiser cannot serve under Vitest).
 */

const CRITICAL_TITLE = 'Zero-Day Exploit Trends: What 2026 Revealed About API Ingress';
const RANSOMWARE_TITLE = 'Ransomware Playbooks Now Targeting East African SACCOs';

function renderBlog() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BlogPage />
    </QueryClientProvider>,
  );
}

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.vv-article-card'));
}

describe('BlogPage', () => {
  it('renders hero, counter, pills and the six fixture cards', async () => {
    renderBlog();
    expect(screen.getByText('Threat Intelligence · Field Reports')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'News & Threat Reports' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'CVE analysis, incident-response field notes and defensive engineering from the VUNVAULT sensor network — written for the people who have to act on it.',
      ),
    ).toBeInTheDocument();

    await waitFor(() => expect(cards()).toHaveLength(6));
    expect(screen.getByText('Showing 6 reports')).toBeInTheDocument();

    // Pills: All + every category present in the fixtures, in label-map order.
    const tablist = screen.getByRole('tablist', { name: 'Filter reports by category' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All',
      'News',
      'Threat Intel',
      'Blog',
      'Industry Updates',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    // The ticker and scanner CTA frame the page (Tasks 47/48).
    expect(screen.getAllByText('CVE-2026-9122').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Request Free Scan' })).toBeInTheDocument();
  });

  it('features the CRITICAL item as the highest-priority report', async () => {
    renderBlog();
    await waitFor(() => expect(document.getElementById('vv-featured')).not.toBeNull());
    const featured = document.getElementById('vv-featured');
    if (featured === null) throw new Error('Featured banner did not render.');
    expect(within(featured).getByText('Featured Report')).toBeInTheDocument();
    expect(within(featured).getByText("Editor's Pick · Highest Priority")).toBeInTheDocument();
    expect(within(featured).getByRole('heading', { name: CRITICAL_TITLE })).toBeInTheDocument();
    expect(within(featured).getByText('Read Full Report')).toBeInTheDocument();
    const critical = publicContent.find((item) => item.severity === 'critical');
    expect(featured.getAttribute('href')).toBe(`/blog/${critical?.slug}`);
  });

  it('debounces the search and filters through the q param', async () => {
    const user = userEvent.setup();
    renderBlog();
    await waitFor(() => expect(cards()).toHaveLength(6));

    await user.type(screen.getByRole('searchbox', { name: 'Search reports' }), 'Ransomware');
    // Immediately after typing the old list is still up (debounce window)…
    expect(cards().length).toBeGreaterThan(0);
    await waitFor(() => expect(cards()).toHaveLength(1), { timeout: 3000 });
    expect(screen.getByText(RANSOMWARE_TITLE)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Showing 1 reports')).toBeInTheDocument());
  });

  it('filters by category pill', async () => {
    const user = userEvent.setup();
    renderBlog();
    await waitFor(() => expect(cards()).toHaveLength(6));

    await user.click(screen.getByRole('tab', { name: 'Threat Intel' }));
    expect(screen.getByRole('tab', { name: 'Threat Intel' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(cards()).toHaveLength(1), { timeout: 3000 });
    // The CRITICAL post appears twice now: the featured banner and the
    // (single-item) filtered grid — assert on the grid.
    const grid = document.getElementById('vv-news-grid');
    if (grid === null) throw new Error('News grid did not render.');
    expect(within(grid).getByText(CRITICAL_TITLE)).toBeInTheDocument();
  });

  it('shows the verbatim empty state and Clear Filters resets', async () => {
    const user = userEvent.setup();
    renderBlog();
    await waitFor(() => expect(cards()).toHaveLength(6));

    await user.type(
      screen.getByRole('searchbox', { name: 'Search reports' }),
      'zzz-no-such-report',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'No matching threat reports found' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        'Nothing in our current advisory set matches that query. Try a broader search term, switch categories, or clear the filters to see the full feed.',
      ),
    ).toBeInTheDocument();
    expect(cards()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(cards()).toHaveLength(6), { timeout: 3000 });
  });
});

describe('NewsletterForm', () => {
  it('subscribes, toasts the planner copy and clears the field', async () => {
    useToastStore.setState({ toasts: [] });
    const user = userEvent.setup();
    renderBlog();
    await waitFor(() => expect(cards()).toHaveLength(6));

    expect(screen.getByText('Threat Advisory Newsletter')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Get zero-day briefings before the exploit drops.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No spam. Unsubscribe anytime. We only send threat intelligence.'),
    ).toBeInTheDocument();

    const email = screen.getByLabelText('Email address');
    await user.type(email, 'analyst@example.com');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Check your inbox',
      message: 'We sent a confirmation link to your email address.',
    });
    await waitFor(() => expect(email).toHaveValue(''));
  });
});
