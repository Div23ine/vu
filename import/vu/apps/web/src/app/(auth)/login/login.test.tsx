// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAGIC_LINK_ACK_MESSAGE } from '@vunvault/contracts';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import { MagicLinkCard } from './_components/magic-link-card';

/**
 * Magic-link login card tests (Phase 1) — validation copy, the request →
 * "Check your email" transition, the strict request body (`next` rides along
 * only when it is a safe same-origin path), resend / different-email, the
 * rate-limit inline error and the `?error=` toast mapping (OAuth returns AND
 * magic-link verify refusals).
 *
 * The card NEVER branches on registration status: the mock answers every
 * well-formed request with the identical generic ack, exactly like the API,
 * and the sent view is asserted to be byte-identical for a fixture email and
 * an unknown one. Requests run through the real api client against MSW.
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const locationAssign = vi.fn();
let queryClient: QueryClient;
let lastMagicBody: Record<string, unknown> | null = null;
let magicCalls = 0;
let locationSearch = '';

function renderCard(props: Partial<Parameters<typeof MagicLinkCard>[0]> = {}) {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MagicLinkCard next={null} error={null} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  routerReplace.mockClear();
  locationAssign.mockClear();
  locationSearch = '';
  lastMagicBody = null;
  magicCalls = 0;
  useToastStore.setState({ toasts: [] });
  // lib/api.ts reads `window.location.pathname` for the auth-flow guard and
  // the hook reads `.search` for `?next=`; jsdom's Location is unforgeable,
  // so swap the whole object (session.test pattern).
  vi.stubGlobal('location', {
    pathname: '/login',
    get search() {
      return locationSearch;
    },
    href: 'http://localhost/login',
    assign: locationAssign,
  });

  server.use(
    http.post('*/api/v1/auth/magic-link', async ({ request }) => {
      magicCalls += 1;
      lastMagicBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ message: MAGIC_LINK_ACK_MESSAGE });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MagicLinkCard — copy and layout', () => {
  it('renders the verbatim strings and links, and has NO password field', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to access your security console.')).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT')).toBeInTheDocument();
    for (const label of ['Google', 'GitHub', 'Microsoft']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText('Don’t have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/signup');
    expect(
      screen.getByText('Secured with 256-bit TLS · Zero-knowledge credential handling'),
    ).toBeInTheDocument();

    // The password login surface is gone: no password input, no remember-me,
    // no forgot-password link anywhere on the card.
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByText('Keep me signed in on this device')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Forgot Password?' })).toBeNull();

    // Full page, not a dialog (spec note).
    expect(document.getElementById('vvLoginCard')?.tagName).toBe('MAIN');
    expect(document.getElementById('vvLoginCard')).not.toHaveAttribute('role');

    expect(document.getElementById('vvLoginForm')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Send Sign-In Link' })).toBeInTheDocument();
    expect(document.getElementById('vvMagicLinkSent')).toBeNull();
  });
});

describe('MagicLinkCard — validation', () => {
  it('empty submit shows the required message and never hits the API', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    expect(await screen.findByText('Email address is required.')).toBeInTheDocument();
    expect(magicCalls).toBe(0);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('shows the malformed-email message with aria-invalid', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), 'nope@');
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await waitFor(() =>
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(magicCalls).toBe(0);
  });
});

describe('MagicLinkCard — request → Check your email', () => {
  it('a valid email flips to the sent view with the strict Phase 4 body', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(clientProfile.email)).toBeVisible();
    expect(screen.getByText(/It expires in 15 minutes and can only be used once\./)).toBeVisible();
    expect(document.getElementById('vvLoginForm')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resend link' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Use a different email' })).toBeVisible();
    expect(lastMagicBody).toEqual({
      email: clientProfile.email,
      website: '',
      formTs: expect.any(Number),
    });
    expect(magicCalls).toBe(1);
  });

  it('an unregistered address gets the IDENTICAL sent view (no enumeration)', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), 'stranger@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText('stranger@example.com')).toBeVisible();
    // Same generic request, same generic view — the UI never learns whether
    // the address is registered (the API answers identically; the unregistered
    // mailbox gets a signup invitation instead of a link).
    expect(lastMagicBody).toEqual({
      email: 'stranger@example.com',
      website: '',
      formTs: expect.any(Number),
    });
    expect(screen.queryByText(/not registered/i)).toBeNull();
    expect(screen.queryByText(/no account/i)).toBeNull();
  });

  it('a safe ?next= rides along in the body; an unsafe one is dropped', async () => {
    const user = userEvent.setup();
    locationSearch = '?next=%2Fportal%2Fbilling';
    const first = renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(lastMagicBody).toEqual({
      email: clientProfile.email,
      next: '/portal/billing',
      website: '',
      formTs: expect.any(Number),
    });
    first.unmount();

    // Protocol-relative next is an open-redirect attempt → omitted entirely.
    lastMagicBody = null;
    locationSearch = '?next=%2F%2Fevil.example%2Fphish';
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(lastMagicBody).toEqual({
      email: clientProfile.email,
      website: '',
      formTs: expect.any(Number),
    });
    expect(lastMagicBody).not.toHaveProperty('next');
  });

  it('Resend re-requests and stays on the sent view', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    await user.click(screen.getByRole('button', { name: 'Resend link' }));
    await waitFor(() => expect(magicCalls).toBe(2));
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  });

  it('"Use a different email" returns to the request form', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    await waitFor(() => expect(document.getElementById('vvLoginForm')).not.toBeNull());
    expect(document.getElementById('vvMagicLinkSent')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send Sign-In Link' })).toBeEnabled();
  });

  it('a 429 shows the inline wait message and stays on the form', async () => {
    server.use(
      http.post('*/api/v1/auth/magic-link', () =>
        HttpResponse.json({ error: 'rate_limited' }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    expect(
      await screen.findByText('Too many requests. Please wait a few minutes before trying again.'),
    ).toBeVisible();
    expect(document.getElementById('vvLoginForm')).not.toBeNull();
    expect(document.getElementById('vvMagicLinkSent')).toBeNull();
  });
});

describe('MagicLinkCard — ?error= toasts', () => {
  it('maps a magic-link verify refusal to the verbatim toast, once', async () => {
    renderCard({ error: 'magic_link_expired' });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'Sign-in',
        message: 'This sign-in link has expired. Please request a new one.',
      }),
    );
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('maps the other verify-refusal codes', async () => {
    const cases: Array<[string, string]> = [
      ['magic_link_invalid', 'This sign-in link is invalid. Please request a new one.'],
      ['magic_link_used', 'This sign-in link has already been used. Please request a new one.'],
      ['account_blocked', 'This account is blocked. Please contact your administrator.'],
      [
        'account_inactive',
        'This account is not active yet. Check your inbox to finish signing up.',
      ],
      ['sign_in_unavailable', 'Sign-in is temporarily unavailable. Please try again later.'],
      ['mfa_required', 'Multi-factor authentication is required for this account.'],
    ];
    for (const [code, message] of cases) {
      useToastStore.setState({ toasts: [] });
      const { unmount } = renderCard({ error: code });
      await waitFor(() =>
        expect(useToastStore.getState().toasts[0]).toMatchObject({ kind: 'warn', message }),
      );
      unmount();
    }
  });

  it('ignores unknown codes and renders without a toast', async () => {
    renderCard({ error: 'totally_bogus' });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — bot-defence carriage (honeypot + timing) and the captcha soft
// limit: `captchaRequired: true` flips the card to the Turnstile view and the
// solved token re-submits; an unavailable widget shows the fallback copy.
// ---------------------------------------------------------------------------

describe('MagicLinkCard — Phase 4 bot defence + captcha', () => {
  function captchaResponder(mode: 'solve' | 'refuse') {
    return http.post('*/api/v1/auth/magic-link', async ({ request }) => {
      magicCalls += 1;
      lastMagicBody = (await request.json()) as Record<string, unknown>;
      if (mode === 'solve' && typeof lastMagicBody?.captchaToken === 'string') {
        return HttpResponse.json({ message: MAGIC_LINK_ACK_MESSAGE });
      }
      if (mode === 'refuse' && typeof lastMagicBody?.captchaToken === 'string') {
        return HttpResponse.json(
          { error: 'captcha_failed', message: 'The human-verification check did not pass' },
          { status: 400 },
        );
      }
      return HttpResponse.json({ message: MAGIC_LINK_ACK_MESSAGE, captchaRequired: true });
    });
  }

  it('renders the honeypot invisible and forwards whatever a bot puts in it', async () => {
    const user = userEvent.setup();
    renderCard();
    const honeypot = document.getElementById('vvWebsite') as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.closest('.vv-honeypot')).toHaveAttribute('aria-hidden', 'true');

    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    fireEvent.change(honeypot as HTMLInputElement, {
      target: { value: 'http://spam.example' },
    });
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    // The server drops the request silently — the client still sees the
    // identical generic ack and flips to "Check your email" (by design: a bot
    // must not learn it was detected).
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(lastMagicBody).toMatchObject({
      email: clientProfile.email,
      website: 'http://spam.example',
    });
    // The timing signal rides along: a mount epoch, in the past, in ms.
    const formTs = (lastMagicBody as { formTs: number }).formTs;
    expect(typeof formTs).toBe('number');
    expect(formTs).toBeGreaterThan(1_700_000_000_000);
    expect(formTs).toBeLessThanOrEqual(Date.now());
  });

  it('captchaRequired flips to the Turnstile view; a solved token re-submits to the sent view', async () => {
    server.use(captchaResponder('solve'));
    let solve: ((token: string) => void) | null = null;
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback: (token: string) => void }): string => {
          solve = options.callback;
          return 'widget-1';
        },
      },
    });

    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    // Not the sent view — the captcha challenge is.
    expect(await screen.findByRole('heading', { name: 'One more step' })).toBeVisible();
    expect(document.getElementById('vvCaptchaChallenge')).not.toBeNull();
    expect(document.getElementById('vvMagicLinkSent')).toBeNull();
    expect(magicCalls).toBe(1);

    // Solving the widget re-submits the SAME email with the token.
    await act(async () => {
      solve?.('solved-token');
    });
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(magicCalls).toBe(2);
    expect(lastMagicBody).toMatchObject({
      email: clientProfile.email,
      captchaToken: 'solved-token',
    });

    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('a refused token surfaces the generic failure inline, never the sent view', async () => {
    server.use(captchaResponder('refuse'));
    let solve: ((token: string) => void) | null = null;
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback: (token: string) => void }): string => {
          solve = options.callback;
          return 'widget-1';
        },
      },
    });

    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));
    await screen.findByRole('heading', { name: 'One more step' });

    await act(async () => {
      solve?.('bad-token');
    });
    // The hook's catch resets to the form with the inline failure copy.
    await waitFor(() =>
      expect(
        screen.getByText('Could not send the sign-in link. Please try again.'),
      ).toBeInTheDocument(),
    );
    expect(document.getElementById('vvMagicLinkSent')).toBeNull();

    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('an unavailable widget (no site key, no script) shows the fallback copy and Back returns to the form', async () => {
    server.use(captchaResponder('solve'));
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Send Sign-In Link' }));

    expect(
      await screen.findByText('Human verification is unavailable. Please try again later.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(document.getElementById('vvLoginForm')).not.toBeNull();
    expect(document.getElementById('vvCaptchaChallenge')).toBeNull();
  });
});
