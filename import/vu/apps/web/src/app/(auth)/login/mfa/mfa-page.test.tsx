import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import MfaPage from './page';

/**
 * `/login/mfa` route tests (Phase 1) — the server page is the gatekeeper:
 * no HttpOnly `vv_mfa` challenge cookie → "No active sign-in" (a dead OTP
 * form is never rendered); with a cookie, the redirect's `?methods=` CSV is
 * filtered to known challenge types (unknown tokens dropped, empty → the
 * full list), `?to=` is echoed only within a sane length (it arrives
 * SERVER-masked — the full email never travels in a URL) and `?next=` runs
 * through `safeNextPath` before the panel sees it.
 */

const routerReplace = vi.hoisted(() => vi.fn());
const locationAssign = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

/** Mutable stand-in for next/headers `cookies()`. */
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

let queryClient: QueryClient;

async function renderPage(params: { methods?: string; to?: string; next?: string } = {}) {
  const ui = await MfaPage({ searchParams: Promise.resolve(params) });
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  routerReplace.mockClear();
  locationAssign.mockClear();
  cookieJar.clear();
  useToastStore.setState({ toasts: [] });
  vi.stubGlobal('location', {
    pathname: '/login/mfa',
    search: '',
    href: 'http://localhost/login/mfa',
    assign: locationAssign,
  });
});

describe('MfaPage — no challenge cookie', () => {
  it('renders "No active sign-in" instead of a dead form', async () => {
    await renderPage({ methods: 'totp', to: 're••@vunvault.com', next: '/portal' });
    expect(screen.getByRole('heading', { name: 'No active sign-in' })).toBeInTheDocument();
    expect(document.getElementById('vvBackToSignIn')).toHaveAttribute('href', '/login');
    expect(document.getElementById('vvOtpCard')).toBeNull();
    expect(document.querySelector('.vv-otp-digit')).toBeNull();
  });
});

describe('MfaPage — with a challenge cookie', () => {
  beforeEach(() => {
    cookieJar.set('vv_mfa', 'mock-challenge-handle');
  });

  it('renders the panel from the redirect params', async () => {
    await renderPage({ methods: 'totp,email_otp', to: 're••••@vunvault.com', next: '/portal' });
    expect(screen.getByRole('heading', { name: 'Verify it’s you' })).toBeInTheDocument();
    // totp wins the default priority.
    expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeVisible();
    expect(screen.getByRole('link', { name: /Back to sign in/i })).toHaveAttribute(
      'href',
      '/login?next=%2Fportal',
    );
  });

  it('drops unknown method tokens', async () => {
    await renderPage({ methods: 'totp,bogus,hack' });
    expect(screen.getByRole('heading', { name: 'Verify it’s you' })).toBeInTheDocument();
    // Only totp survived → the switcher offers recovery and nothing else.
    expect(screen.queryByRole('button', { name: 'Use security key' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use a recovery code' })).toBeVisible();
  });

  it('falls back to the full method list when methods is absent', async () => {
    await renderPage({});
    expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use security key' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Use a recovery code' })).toBeVisible();
  });

  it('sanitises a hostile ?next= away', async () => {
    await renderPage({ methods: 'totp', next: '//evil.example/phish' });
    expect(screen.getByRole('link', { name: /Back to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('echoes the masked to= in the email-OTP copy, and only when sane', async () => {
    await renderPage({ methods: 'email_otp', to: 're••••@vunvault.com' });
    expect(document.getElementById('vvOtpTarget')).toHaveTextContent('re••••@vunvault.com');
  });

  it('ignores an oversized to= (falls back to "your email")', async () => {
    await renderPage({ methods: 'email_otp', to: 'x'.repeat(300) });
    expect(document.getElementById('vvOtpTarget')).toHaveTextContent('your email');
  });
});
