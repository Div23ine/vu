// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryKeys, createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import { MOCK_INVALID_TOKEN, mockAcceptedSession } from '../../../mocks/handlers/auth-misc';
import { AuthCard } from './auth-card';
import { AcceptInviteForm } from '../accept-invite/_components/accept-invite-form';
import { NewsletterConfirmCard } from '../newsletter/confirm/_components/newsletter-confirm-card';

/**
 * Auth-adjacent page tests — the accept-invite 404 and activation flows with
 * the fixture role + team, and the newsletter confirm pending → success and
 * 404 transitions. (The forgot/reset-password forms died with password login
 * in Phase 5.)
 *
 * The standing mock handlers come from `mocks/handlers/auth-misc.ts`;
 * failure-path variations use `server.use` overrides.
 */

/** Any token except `MOCK_INVALID_TOKEN` succeeds against the mocks. */
const VALID_TOKEN = 'valid-token-0123456789abcdef0123456789';
const STAFF_PASSWORD = 'Str0ng!StaffPass1';

let queryClient: QueryClient;

function renderWithClient(ui: React.ReactElement) {
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('AuthCard — shared shell', () => {
  it('renders the auth-card chrome with brand, title and sub', () => {
    renderWithClient(<AuthCard title="Card title" sub="Card sub" />);
    const card = document.getElementById('vvAuthCard');
    expect(card?.tagName).toBe('MAIN');
    expect(card).toHaveClass('vv-auth-card');
    expect(card).not.toHaveAttribute('role');
    expect(screen.getByRole('heading', { name: 'Card title' })).toBeInTheDocument();
    expect(screen.getByText('Card sub')).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT')).toBeInTheDocument();
  });
});

describe('AcceptInviteForm', () => {
  it('renders the invalid state for an unknown token', async () => {
    renderWithClient(<AcceptInviteForm token={MOCK_INVALID_TOKEN} />);
    expect(
      await screen.findByRole('heading', { name: 'Invitation not valid' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This invitation link is invalid or has expired. Ask an administrator to send a new one.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the fixture role, team and read-only work email', async () => {
    renderWithClient(<AcceptInviteForm token={VALID_TOKEN} />);
    // The skeleton state shares the heading — wait for the loaded form.
    expect(await screen.findByText('Security Analyst')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Join VUNVAULT' })).toBeInTheDocument();
    expect(screen.getByText(/Offensive Security/)).toBeInTheDocument();
    expect(screen.getByText("You've been invited as", { exact: false })).toBeInTheDocument();
    const workEmail = screen.getByLabelText('Work email');
    expect(workEmail).toHaveValue('j.kariuki@vunvault.com');
    expect(workEmail).toHaveAttribute('readonly');
  });

  it('activates the account, seeds the session and shows Set up MFA', async () => {
    const user = userEvent.setup();
    renderWithClient(<AcceptInviteForm token={VALID_TOKEN} />);
    await screen.findByLabelText('Password');
    await user.type(screen.getByLabelText('Password'), STAFF_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), STAFF_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Activate account' }));
    expect(await screen.findByRole('heading', { name: 'Account activated' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Multi-factor authentication is mandatory for staff accounts. Set it up now to continue.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up MFA' })).toHaveAttribute(
      'href',
      '/admin/profile#security',
    );
    expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({
      id: mockAcceptedSession.id,
    });
  });

  it('enforces the 14-character staff minimum', async () => {
    const user = userEvent.setup();
    renderWithClient(<AcceptInviteForm token={VALID_TOKEN} />);
    await screen.findByLabelText('Password');
    // 13 chars — one short of the staff minimum, but otherwise rule-complete.
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw1');
    await user.type(screen.getByLabelText('Confirm password'), 'Str0ng!Passw1');
    await user.click(screen.getByRole('button', { name: 'Activate account' }));
    expect(
      await screen.findByText('String must contain at least 14 character(s)'),
    ).toBeInTheDocument();
  });
});

describe('NewsletterConfirmCard', () => {
  it('shows the pending line, then the confirmed state', async () => {
    let release: (() => void) | undefined;
    server.use(
      http.post('*/api/v1/newsletter/confirm', async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithClient(<NewsletterConfirmCard token={VALID_TOKEN} />);
    expect(
      screen.getByRole('heading', { name: 'Confirming your subscription…' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(release !== undefined).toBe(true));
    release?.();
    expect(
      await screen.findByRole('heading', { name: 'Subscription confirmed' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You will now receive VUNVAULT threat advisories.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the blog' })).toHaveAttribute('href', '/blog');
  });

  it('shows the invalid state for a used token', async () => {
    renderWithClient(<NewsletterConfirmCard token={MOCK_INVALID_TOKEN} />);
    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
    expect(
      screen.getByText('This confirmation link is invalid or has already been used.'),
    ).toBeInTheDocument();
  });

  it('shows the invalid state when the token is missing', () => {
    renderWithClient(<NewsletterConfirmCard token={null} />);
    expect(screen.getByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
  });
});
