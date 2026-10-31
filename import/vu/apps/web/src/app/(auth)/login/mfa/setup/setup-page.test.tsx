import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import MfaSetupPage from './page';

/**
 * `/login/mfa/setup` route tests (Phase 2) — the server page is the
 * gatekeeper, mirroring `/login/mfa`: no HttpOnly `vv_mfa` challenge cookie →
 * "No active sign-in" (a dead enrolment form is never rendered). With a
 * cookie, `?deadline=` survives only as strict digits (epoch ms — anything
 * else is dropped and the untimed variant renders), `?to=` is echoed only
 * within a sane length (it arrives SERVER-masked) and `?next=` runs through
 * `safeNextPath` before the panel sees it.
 */

const routerReplace = vi.hoisted(() => vi.fn());

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

async function renderPage(params: { deadline?: string; to?: string; next?: string } = {}) {
  const ui = await MfaSetupPage({ searchParams: Promise.resolve(params) });
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  routerReplace.mockClear();
  cookieJar.clear();
  useToastStore.setState({ toasts: [] });
});

describe('MfaSetupPage — no challenge cookie', () => {
  it('renders "No active sign-in" instead of a dead enrolment form', async () => {
    await renderPage({ deadline: String(Date.now() + 300_000), to: 'da••••@vunvault.com' });
    expect(screen.getByRole('heading', { name: 'No active sign-in' })).toBeInTheDocument();
    expect(document.getElementById('vvSetupBackToSignIn')).toHaveAttribute('href', '/login');
    expect(document.getElementById('vvSetupCard')).toBeNull();
    expect(document.querySelector('.vv-otp-digit')).toBeNull();
  });
});

describe('MfaSetupPage — with a challenge cookie', () => {
  beforeEach(() => {
    cookieJar.set('vv_mfa', 'mock-challenge-handle');
  });

  it('passes a digit-only deadline through as the visible countdown', async () => {
    await renderPage({ deadline: String(Date.now() + 300_000), to: 'da••••@vunvault.com' });
    // The panel POSTs options on mount, then renders the QR + timer.
    expect(await screen.findByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^[45]:\d{2}$/);
    expect(screen.getByText(/da••••@vunvault\.com/)).toBeInTheDocument();
  });

  it('drops a hostile deadline and renders the untimed variant', async () => {
    await renderPage({ deadline: '12e9', to: 'da••••@vunvault.com' });
    expect(await screen.findByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument();
    expect(document.getElementById('vvSetupTimer')).toBeNull();
    expect(document.getElementById('vvSetupAbandon')).toBeNull();
  });

  it('drops an over-long ?to= instead of echoing it', async () => {
    await renderPage({ to: 'x'.repeat(255) });
    expect(await screen.findByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument();
    expect(screen.queryByText(/xxxx/)).toBeNull();
  });

  it('runs ?next= through safeNextPath into the panel', async () => {
    await renderPage({ next: '/admin/profile' });
    expect(await screen.findByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument();
    expect(document.getElementById('vvSetupBack')).toHaveAttribute(
      'href',
      '/login?next=%2Fadmin%2Fprofile',
    );
  });

  it('drops an absolute (open-redirect) ?next=', async () => {
    await renderPage({ next: 'https://evil.example/phish' });
    expect(await screen.findByRole('img', { name: 'Authenticator QR code' })).toBeInTheDocument();
    expect(document.getElementById('vvSetupBack')).toHaveAttribute('href', '/login');
  });
});
