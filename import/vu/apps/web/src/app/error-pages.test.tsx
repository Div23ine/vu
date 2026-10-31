// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import ErrorPage from './error';
import ForbiddenPage from './forbidden/page';
import GlobalError from './global-error';
import NotFound from './not-found';
import { mockStaffSession } from '../mocks/handlers/auth';
import { server } from '../mocks/server';

/**
 * Smoke tests for the four an earlier iteration error pages: each renders, and each
 * asserts its authored copy verbatim.
 *
 * These pages have no design — the spec authors the copy — so the
 * strings below are the specification.
 */

const replaceSpy = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => '/missing-page',
  useRouter: () => ({ replace: replaceSpy }),
}));

function renderWithSession(element: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(element, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('not-found', () => {
  it('redirects home with the wanted path instead of showing a 404', () => {
    renderWithSession(<NotFound />);
    expect(replaceSpy).toHaveBeenCalledWith('/?coming-soon=%2Fmissing-page');
    expect(screen.getByText('Taking you back to the landing page…')).toBeInTheDocument();
  });
});

describe('forbidden', () => {
  it('renders the 403 copy and points an unknown session at the portal', async () => {
    // No mock-session cookie → the auth handler answers 401 → user stays null
    // → the workspace link falls back to the client portal.
    renderWithSession(<ForbiddenPage />);
    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access restricted' })).toBeInTheDocument();
    expect(
      screen.getByText('Your account does not have permission to view this page.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Back to my workspace' })).toHaveAttribute(
        'href',
        '/portal',
      ),
    );
  });

  it('points a staff session at the Command Center', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockStaffSession })),
    );
    renderWithSession(<ForbiddenPage />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Back to my workspace' })).toHaveAttribute(
        'href',
        '/admin',
      ),
    );
  });
});

describe('error', () => {
  it('renders the failure copy and Try again calls reset', async () => {
    const reset = vi.fn();
    render(<ErrorPage reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'An unexpected error occurred. Try again, and contact support if it keeps happening.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('global-error', () => {
  it('mirrors the error page inside its own html/body shell', async () => {
    // React logs DOM-nesting warnings for <html> rendered inside the test
    // container's <div>. That is an artefact of the harness: in production this
    // component REPLACES the document root. The noise is silenced here rather
    // than asserted away.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<GlobalError reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'An unexpected error occurred. Try again, and contact support if it keeps happening.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
