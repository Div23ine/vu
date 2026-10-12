// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PentestRequest } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { mockClientSession } from '../../../../mocks/handlers/auth';
import { server } from '../../../../mocks/server';
import { useSessionStore } from '../../../../lib/session';
import { PortalHeader } from './portal-header';
import {
  PAST_DATE_MESSAGE,
  RequestPenTestDialog,
  TARGET_REQUIRED_MESSAGE,
  usePentestDialog,
} from './request-pentest-dialog';

/**
 * Portal chrome + Request PenTest dialog tests (Task 45).
 *
 * The header and the dialog are rendered together (as the portal layout does)
 * so the CTA → store → dialog wiring is exercised for real. Requests hit the
 * MSW pentest handler, which enforces the contract and the target rules.
 */

const routeState = vi.hoisted(() => ({ pathname: '/portal' }));
vi.mock('next/navigation', () => ({
  usePathname: () => routeState.pathname,
}));

beforeAll(() => {
  // Radix needs these browser APIs; jsdom does not implement them (the same
  // stubs the design-system's own overlay tests use).
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

function renderPortalChrome() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PortalHeader />
      <RequestPenTestDialog />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  routeState.pathname = '/portal';
  usePentestDialog.setState({ open: false });
  useToastStore.setState({ toasts: [] });
  // Radix's scroll lock and the drawer's body class can outlive a test that
  // unmounts an open dialog; start every case from a clean <body>.
  document.body.className = '';
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-scroll-locked');
});

describe('PortalHeader', () => {
  it('renders the four portal nav labels and the Request PenTest CTA', () => {
    renderPortalChrome();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(primary).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Academy Progress',
      'Free Vulnerability Scanner',
      'Billing & Invoices',
      'Password Manager',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/portal/academy',
      '/portal/scanner',
      '/portal/billing',
      '/portal/security',
    ]);
    expect(screen.getByRole('button', { name: 'Request PenTest' })).toBeInTheDocument();
  });

  it('marks the active portal route', () => {
    routeState.pathname = '/portal/billing/invoice-42';
    renderPortalChrome();
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Billing & Invoices' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it("opens the drawer's + Request PenTest item into the same dialog", async () => {
    const user = userEvent.setup();
    renderPortalChrome();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const drawer = screen.getByRole('navigation', { name: 'Mobile' });
    await user.click(within(drawer).getByRole('button', { name: '+ Request PenTest' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // The drawer closed on the way.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('RequestPenTestDialog', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Request PenTest' }));
    return await screen.findByRole('dialog');
  }

  it('opens from the CTA with a labelled title and aria-modal', async () => {
    const user = userEvent.setup();
    renderPortalChrome();
    const dialog = await openDialog(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = within(dialog).getByRole('heading', { name: 'Request a Penetration Test' });
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(within(dialog).getByText('Secure engagement intake')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Tell us what to test and when. A named engagement lead will confirm scope, authorisation and scheduling within one business day.',
      ),
    ).toBeInTheDocument();
    // Escape closes (Radix) — and the store follows.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(usePentestDialog.getState().open).toBe(false);
  });

  it('shows the required-target message with role="alert" on an empty submit', async () => {
    const user = userEvent.setup();
    renderPortalChrome();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Submit Request' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(TARGET_REQUIRED_MESSAGE);
    expect(alert).toHaveTextContent('Enter the URL or IP range to test.');
    expect(within(dialog).getByLabelText('Scope / Target URL')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('rejects a past preferred schedule', async () => {
    const user = userEvent.setup();
    renderPortalChrome();
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('Scope / Target URL'), 'https://app.example.com');
    fireEvent.change(within(dialog).getByLabelText('Preferred Schedule'), {
      target: { value: '2020-01-01T10:00' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit Request' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(PAST_DATE_MESSAGE);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('submits { targetUrl, targetType }, toasts the reference and closes', async () => {
    // The session provides the email quoted in the success toast.
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockClientSession })),
    );
    let captured: unknown = null;
    const created: PentestRequest = {
      id: 'd0000000-0000-4000-8000-000000000042',
      refCode: 'VV-PT-000042',
      targetUrl: 'https://app.example.com',
      targetType: 'web_application',
      status: 'received',
      createdAt: '2026-09-24T12:00:00Z',
    };
    server.use(
      http.post('*/api/v1/pentest-requests', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ data: created }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderPortalChrome();
    const dialog = await openDialog(user);

    // The toast quotes the session email — make sure the query resolved first.
    await waitFor(() => expect(useSessionStore.getState().user?.email).toBeDefined());

    await user.type(within(dialog).getByLabelText('Scope / Target URL'), 'https://app.example.com');
    await user.selectOptions(within(dialog).getByLabelText('Target Type'), 'web_application');
    await user.click(within(dialog).getByRole('button', { name: 'Submit Request' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(captured).toMatchObject({
      targetUrl: 'https://app.example.com',
      targetType: 'web_application',
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ kind: 'ok', title: 'Request received' });
    expect(toasts[0]?.message).toContain('jane.wanjiru@acmefintech.co.ke');
    expect(toasts[0]?.message).toContain('VV-PT-000042');
  });

  it('shows the inline 422 error for a disallowed target', async () => {
    const user = userEvent.setup();
    renderPortalChrome();
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('Scope / Target URL'), 'http://127.0.0.1');
    await user.click(within(dialog).getByRole('button', { name: 'Submit Request' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(
      'Internal and private addresses cannot be requested here. Contact your engagement lead.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // stays open

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
