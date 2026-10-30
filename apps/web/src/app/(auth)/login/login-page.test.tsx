import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { env } from '../../../env';
import { safeNextPath } from './_lib/next-path';
import LoginPage from './page';

/**
 * `/login` route tests (Phase 1) — the server page renders the magic-link
 * card, sanitises `?next=` BEFORE the client ever sees it (open-redirect
 * guard, unit-pinned here) and forwards `?error=` to the card's toast map.
 *
 * The old `?mfa=1` / step=code&handle surfaces are gone: the second factor
 * lives at `/login/mfa` and the API redirects there itself.
 */

const routerReplace = vi.hoisted(() => vi.fn());
const locationAssign = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

let queryClient: QueryClient;

async function renderPage(params: { next?: string; error?: string } = {}) {
  const ui = await LoginPage({ searchParams: Promise.resolve(params) });
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  routerReplace.mockClear();
  locationAssign.mockClear();
  useToastStore.setState({ toasts: [] });
  vi.stubGlobal('location', {
    pathname: '/login',
    search: '',
    href: 'http://localhost/login',
    assign: locationAssign,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeNextPath — open-redirect guard', () => {
  it('accepts only single-slash same-origin paths', () => {
    expect(safeNextPath('/portal')).toBe('/portal');
    expect(safeNextPath('/portal/billing?tab=x')).toBe('/portal/billing?tab=x');
  });

  it('rejects protocol-relative, backslash, absolute and empty values', () => {
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('javascript:alert(1)')).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe('LoginPage — server route', () => {
  it('renders the magic-link card with no password surface', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send Sign-In Link' })).toBeInTheDocument();
  });

  it('passes a safe ?next= through to the OAuth start URL', async () => {
    const user = userEvent.setup();
    await renderPage({ next: '/portal/billing' });
    await user.click(screen.getByRole('button', { name: 'Google' }));
    expect(locationAssign).toHaveBeenCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/google/start?next=%2Fportal%2Fbilling`,
    );
  });

  it('sanitises an unsafe ?next= away before the client sees it', async () => {
    const user = userEvent.setup();
    await renderPage({ next: '//evil.example/phish' });
    await user.click(screen.getByRole('button', { name: 'Google' }));
    // Falls back to the neutral '/' — the hostile target never reaches a URL.
    expect(locationAssign).toHaveBeenCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/google/start?next=%2F`,
    );
  });

  it('forwards ?error= into the card toast map', async () => {
    await renderPage({ error: 'magic_link_used' });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'Sign-in',
        message: 'This sign-in link has already been used. Please request a new one.',
      }),
    );
  });
});
