// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import {
  acknowledgeSeedAdvisory,
  advisorySeed,
  resetAdvisoryAcks,
} from '../../../../mocks/handlers/advisories';
import { server } from '../../../../mocks/server';
import AdvisoriesPage from './page';

/**
 * Portal advisories tests (Task 70) — the spec's list: the cards render the
 * MSW fields, acknowledge is optimistic and idempotent, the unacknowledged
 * critical is pinned first, the references are safe external links and the
 * empty state. Plus the spec'd failure path: roll back with the `crit`
 * toast.
 */

function seed(cveId: string) {
  const found = advisorySeed.find((item) => item.cveId === cveId);
  if (found === undefined) throw new Error(`The advisory seed has no ${cveId}.`);
  return found;
}

const CRITICAL = seed('CVE-2026-21596'); // oldest — pinned first anyway
const HIGH = seed('CVE-2026-30812'); // newest
const MEDIUM = seed('CVE-2026-11477'); // ships acknowledged, empty references
const LOW = seed('CVE-2026-09953'); // null-category scope entry

let queryClient: QueryClient;

function renderFeed() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdvisoriesPage />
    </QueryClientProvider>,
  );
}

/** The `.vad-card` element a card title belongs to. */
function cardOf(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  const card = heading.closest<HTMLElement>('.vad-card');
  if (card === null) throw new Error(`The card for "${title}" is not rendered.`);
  return card;
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdvisoryAcks();
});

describe('/portal/advisories — feed', () => {
  it('renders the hero and every card field from the MSW feed', async () => {
    renderFeed();
    expect(await screen.findByRole('heading', { name: 'Security Advisories' })).toBeInTheDocument();
    expect(screen.getByText('Threat Intelligence')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Emergency zero-day advisories from the VUNVAULT intelligence desk, matched to your environment.',
      ),
    ).toBeInTheDocument();

    // Every seed card arrives with its CVE id (monospace) and severity badge.
    for (const advisory of advisorySeed) {
      await screen.findByRole('heading', { name: advisory.title });
      expect(screen.getByText(advisory.cveId)).toHaveClass('vad-cve');
    }
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();

    // The fixed source line and the `DD Mon YYYY, HH:MM UTC` stamps.
    expect(screen.getAllByText('VUNVAULT Intelligence')).toHaveLength(advisorySeed.length);
    expect(screen.getByText('01 Oct 2026, 09:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('07 Oct 2026, 06:30 UTC')).toBeInTheDocument();
    expect(screen.getByText('05 Oct 2026, 12:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('06 Oct 2026, 18:45 UTC')).toBeInTheDocument();

    // Scope chips: label + category when present, label alone when null.
    expect(screen.getByText('Edge TLS terminators · Network & Edge')).toBeInTheDocument();
    expect(screen.getByText('Payments API · Web & API')).toBeInTheDocument();
    expect(screen.getByText('Customer dashboard · Web & API')).toBeInTheDocument();
    expect(screen.getByText('Corporate SSO · Identity & SSO')).toBeInTheDocument();
    expect(screen.getByText('Field sensors')).toBeInTheDocument();

    // Summary + remediation blocks on every card.
    expect(screen.getAllByText('Summary')).toHaveLength(advisorySeed.length);
    expect(screen.getAllByText('Recommended remediation')).toHaveLength(advisorySeed.length);
    expect(screen.getByText(CRITICAL.summary)).toBeInTheDocument();
    expect(screen.getByText(CRITICAL.remediation)).toBeInTheDocument();

    // Patch-status chips (PATCH_STATUS_LABELS).
    expect(screen.getByText('Unpatched')).toBeInTheDocument();
    expect(screen.getByText('Patch in progress')).toBeInTheDocument();
    expect(screen.getAllByText('Patched')).toHaveLength(2);

    // The pre-acknowledged card shows the disabled state; the rest offer the action.
    expect(screen.getByRole('button', { name: 'Acknowledged' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Acknowledge' })).toHaveLength(3);
  });

  it('pins the unacknowledged critical first, then orders newest first', async () => {
    const { container } = renderFeed();
    await screen.findByRole('heading', { name: CRITICAL.title });

    // The critical is the OLDEST seed entry — pinning beats recency; the rest
    // run newest first (HIGH 07 Oct, LOW 06 Oct, MEDIUM 05 Oct).
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([CRITICAL.title, HIGH.title, LOW.title, MEDIUM.title]);

    const pinned = container.querySelectorAll('.vad-card--pinned');
    expect(pinned).toHaveLength(1);
    expect(pinned[0]?.textContent).toContain(CRITICAL.cveId);
  });

  it('renders references as safe external links', async () => {
    renderFeed();
    await screen.findByRole('heading', { name: CRITICAL.title });

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    }
    const hrefs = links.map((link) => link.getAttribute('href'));
    for (const reference of advisorySeed.flatMap((advisory) => advisory.references)) {
      expect(hrefs).toContain(reference);
    }
  });

  it('shows the empty state when the feed is empty', async () => {
    server.use(http.get('*/api/v1/advisories', () => HttpResponse.json({ data: [], total: 0 })));
    renderFeed();
    expect(await screen.findByText('No active advisories')).toBeInTheDocument();
    expect(
      screen.getByText(
        'We will notify you here and by email when a new zero-day affects your environment.',
      ),
    ).toBeInTheDocument();
  });
});

describe('/portal/advisories — acknowledge', () => {
  it('flips optimistically before the server answers and cannot double-post', async () => {
    const posts: string[] = [];
    server.use(
      http.post('*/api/v1/advisories/:id/acknowledge', async ({ params }) => {
        posts.push(String(params.id));
        acknowledgeSeedAdvisory(String(params.id));
        await delay(1500); // wider than any assertion below — proves optimism
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole('heading', { name: CRITICAL.title });
    const card = cardOf(CRITICAL.title);

    await user.click(within(card).getByRole('button', { name: 'Acknowledge' }));

    // The card flipped while the POST is still in flight: the 500 ms budget
    // is far below the handler's 1.5 s delay, so this cannot be the server.
    const done = await within(card).findByRole(
      'button',
      { name: 'Acknowledged' },
      { timeout: 500 },
    );
    expect(done).toBeDisabled();

    await waitFor(() => expect(posts).toEqual([CRITICAL.id]));

    // Idempotent from the UI: the disabled button cannot post again.
    fireEvent.click(done);
    expect(posts).toEqual([CRITICAL.id]);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('rolls back and fires the crit toast when the acknowledge fails', async () => {
    server.use(
      http.post('*/api/v1/advisories/:id/acknowledge', () =>
        HttpResponse.json({ error: 'request_failed' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole('heading', { name: CRITICAL.title });
    const card = cardOf(CRITICAL.title);

    await user.click(within(card).getByRole('button', { name: 'Acknowledge' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'crit',
        title: 'Could not acknowledge',
        message: 'Please try again.',
      }),
    );
    // Rolled back: the card offers the action again.
    expect(within(card).getByRole('button', { name: 'Acknowledge' })).toBeEnabled();
  });
});
