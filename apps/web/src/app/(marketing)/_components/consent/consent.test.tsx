// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import { ConsentBanner } from './consent-banner';
import { useConsentStore } from './consent-store';

/**
 * Cookie-consent tests (Task 58) — mount rules (shows on mount while
 * undecided, cookie/store suppression), the three recording paths, the
 * customize panel's live chips/announcements, and the leave transition.
 * Fake timers drive the panel focus timeout and the 400 ms unmount. The
 * preloader gate (and its done-event / 6 s fallback) no longer exists, so
 * nothing delays the banner.
 */

let lastPayload: Record<string, unknown> | null = null;

function renderBanner() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ConsentBanner />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  lastPayload = null;
  useToastStore.setState({ toasts: [] });
  useConsentStore.setState({
    decided: false,
    leaving: false,
    prefs: { strictlyNecessary: true, analytics: false, marketing: false, functional: false },
  });
  document.cookie = 'vv_consent=; Max-Age=0; path=/';
  document.body.classList.remove('vv-consent-open');
  server.use(
    http.post('*/api/v1/consent', async ({ request }) => {
      lastPayload = (await request.json()) as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  document.cookie = 'vv_consent=; Max-Age=0; path=/';
});

describe('ConsentBanner — mount rules', () => {
  it('shows on mount while undecided and focuses Accept All', () => {
    renderBanner();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'We value your privacy' })).toBeInTheDocument();
    expect(screen.getByText('Privacy & Consent')).toBeInTheDocument();
    const accept = document.querySelector('[data-vv-consent="accept-all"]');
    expect(document.activeElement).toBe(accept);
    expect(document.body).toHaveClass('vv-consent-open');
  });

  it('never shows when the in-memory store already records a decision', async () => {
    useConsentStore.setState({ decided: true });
    renderBanner();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never shows when the vv_consent cookie already records a decision', async () => {
    document.cookie = 'vv_consent=1; path=/';
    renderBanner();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ConsentBanner — recording', () => {
  it('Accept All posts all-true and unmounts after the leave transition', async () => {
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Accept All' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lastPayload).toEqual({
      categories: {
        strictlyNecessary: true,
        analytics: true,
        marketing: true,
        functional: true,
      },
      policyVersion: '1',
    });

    // Leaving: still mounted (transition) but flagged.
    expect(screen.getByRole('dialog')).toHaveClass('is-leaving');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body).not.toHaveClass('vv-consent-open');
    expect(useConsentStore.getState().decided).toBe(true);
  });

  it('Essential Only posts only strictlyNecessary', async () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Essential Only' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lastPayload).toEqual({
      categories: {
        strictlyNecessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      },
      policyVersion: '1',
    });
  });

  it('keeps the banner open and toasts when recording fails', async () => {
    server.use(
      http.post('*/api/v1/consent', () =>
        HttpResponse.json({ error: 'rate_limited' }, { status: 429 }),
      ),
    );
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Accept All' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveClass('is-leaving');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'Could not save your choice',
      message: 'Please try again.',
    });
    expect(useConsentStore.getState().decided).toBe(false);
  });
});

describe('ConsentBanner — customize panel', () => {
  function openPanel() {
    fireEvent.click(screen.getByRole('button', { name: 'Customize Preferences' }));
  }

  it('opens with live chips, announcements, a disabled necessary switch and focused first toggle', async () => {
    renderBanner();
    openPanel();

    // The quick-action row hides (the hidden attribute removes it from the
    // accessibility tree entirely); the panel shows.
    expect(screen.queryByRole('button', { name: 'Accept All' })).toBeNull();
    const panel = screen.getByRole('region', { name: 'Cookie preferences' });
    expect(panel).toBeVisible();
    expect(screen.getByText('Preference panel opened')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(document.activeElement).toBe(screen.getByLabelText('Analytics cookies'));

    const necessary = screen.getByLabelText('Strictly necessary cookies — always active');
    expect(necessary).toBeDisabled();
    expect(necessary).toBeChecked();

    // Toggling analytics flips the chip text and announces.
    const chips = screen.getByRole('list', { name: 'Cookie categories at a glance' });
    const analyticsChip = within(chips)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith('Analytics'));
    expect(analyticsChip?.textContent).toContain('Off');

    const analyticsLabel = screen.getByLabelText('Analytics cookies').closest('label');
    if (analyticsLabel === null) throw new Error('Analytics switch label missing.');
    fireEvent.click(analyticsLabel);

    const chipAfter = within(chips)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith('Analytics'));
    expect(chipAfter?.textContent).toContain('On');
    expect(screen.getByText('Analytics cookies enabled')).toBeInTheDocument();

    // Back returns to the quick choices.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Accept All' })).toBeInTheDocument();
    expect(screen.getByText('Returned to quick choices')).toBeInTheDocument();
  });

  it('Save posts the toggled values', async () => {
    renderBanner();
    openPanel();
    const marketingLabel = screen.getByLabelText('Marketing cookies').closest('label');
    if (marketingLabel === null) throw new Error('Marketing switch label missing.');
    fireEvent.click(marketingLabel);
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(lastPayload).toEqual({
      categories: {
        strictlyNecessary: true,
        analytics: false,
        marketing: true,
        functional: false,
      },
      policyVersion: '1',
    });
    expect(useConsentStore.getState().decided).toBe(true);
  });
});
