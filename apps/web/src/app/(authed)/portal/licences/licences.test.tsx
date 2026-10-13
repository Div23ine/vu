// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { entitlementSeed } from '../../../../mocks/handlers/store';
import { server } from '../../../../mocks/server';
import LicencesPage from './page';

/**
 * Portal licences tests (Task 73) — the spec's list: the rows render, the
 * key reveals and copies, the expired chip shows by date, the download runs
 * the presigned flow through `window.location.assign`, and a 409
 * `not_available` toasts the verbatim warn pair. Plus the empty state.
 */

const ACTIVE = entitlementSeed[0];
const EXPIRED = entitlementSeed[1];
const NOT_PUBLISHED = entitlementSeed[2];
if (ACTIVE === undefined || EXPIRED === undefined || NOT_PUBLISHED === undefined) {
  throw new Error('The entitlement seed lost a row.');
}

let queryClient: QueryClient;
const clipboardWrite = vi.hoisted(() => vi.fn());

function renderLicences() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LicencesPage />
    </QueryClientProvider>,
  );
}

/** The table row a product name belongs to. */
function rowOf(productName: string): HTMLElement {
  const cell = screen.getByText(productName);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for "${productName}" is missing.`);
  return row;
}

function setupUser() {
  const user = userEvent.setup();
  // userEvent.setup() clobbers navigator stubs — reinstall (the security-test lesson).
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
  });
  return user;
}

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
  useToastStore.setState({ toasts: [] });
  clipboardWrite.mockReset();
  clipboardWrite.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/portal/licences', () => {
  it('renders the hero and one row per entitlement', async () => {
    renderLicences();
    expect(await screen.findByRole('heading', { name: 'Your Licences' })).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Licence keys and downloads for the tools you have purchased. Updates are included for twelve months from purchase.',
      ),
    ).toBeInTheDocument();

    for (const entitlement of entitlementSeed) {
      expect(await screen.findByText(entitlement.productName)).toBeInTheDocument();
    }

    // Keys arrive MASKED: first and last group readable, the middle hidden.
    expect(screen.getByText('VV-K7M2-••••-••••-8NPD')).toBeInTheDocument();
    expect(screen.getByText('VV-T3VW-••••-••••-7RQD')).toBeInTheDocument();
    expect(screen.getByText('VV-B9NF-••••-••••-3XRC')).toBeInTheDocument();
    expect(screen.queryByText('VV-K7M2-9QRT-4XJB-8NPD')).not.toBeInTheDocument();

    // Granted + update-window dates and the Active/Expired chips.
    expect(screen.getByText('15 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('15 Jan 2027')).toBeInTheDocument();
    expect(screen.getByText('2 Nov 2024')).toBeInTheDocument();
    expect(screen.getByText('2 Nov 2025')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(within(rowOf(EXPIRED.productName)).getByText('Expired')).toBeInTheDocument();
  });

  it('reveals the full key and copies it with the verbatim toast', async () => {
    const user = setupUser();
    renderLicences();
    await screen.findByText('VV-K7M2-••••-••••-8NPD');
    const row = rowOf(ACTIVE.productName);

    await user.click(within(row).getByRole('button', { name: 'Reveal' }));
    expect(within(row).getByText(ACTIVE.licenseKey)).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(ACTIVE.licenseKey));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Licence key copied',
    });

    // The toggle flips back.
    await user.click(within(row).getByRole('button', { name: 'Hide' }));
    expect(within(row).getByText('VV-K7M2-••••-••••-8NPD')).toBeInTheDocument();
  });

  it('downloads through the presigned URL and navigates the browser to it', async () => {
    const user = setupUser();
    const posts: string[] = [];
    server.use(
      http.post('*/api/v1/entitlements/:id/download-url', ({ params }) => {
        posts.push(String(params.id));
        return HttpResponse.json({
          data: {
            url: 'https://cdn.vunvault.test/downloads/reconvault-pro.zip?sig=test',
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        });
      }),
    );
    renderLicences();
    await screen.findByText(ACTIVE.productName);

    await user.click(within(rowOf(ACTIVE.productName)).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(posts).toEqual([ACTIVE.id]));
    await waitFor(() =>
      expect(location.assign).toHaveBeenCalledWith(
        'https://cdn.vunvault.test/downloads/reconvault-pro.zip?sig=test',
      ),
    );
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('a 409 not_available toasts the verbatim warn pair and navigates nowhere', async () => {
    const user = setupUser();
    renderLicences();
    await screen.findByText(NOT_PUBLISHED.productName);

    await user.click(
      within(rowOf(NOT_PUBLISHED.productName)).getByRole('button', { name: 'Download' }),
    );
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'Download not available yet',
        message:
          'The archive for this product has not been published. We will email you when it is ready.',
      }),
    );
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('shows the empty state with the Browse products link', async () => {
    server.use(http.get('*/api/v1/entitlements', () => HttpResponse.json({ data: [] })));
    renderLicences();
    expect(await screen.findByText('No licences yet')).toBeInTheDocument();
    expect(
      screen.getByText('Purchase a tool from the Products page to see it here.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute(
      'href',
      '/products',
    );
  });
});
