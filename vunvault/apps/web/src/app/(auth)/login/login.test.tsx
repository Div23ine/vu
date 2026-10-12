// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import { queryKeys, createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { env } from '../../../env';
import { LoginCard } from './_components/login-card';
import { safeNextPath } from './_hooks/use-login';
import { useMfaDialogStore } from './_store/mfa-dialog-store';

/**
 * Login page tests (Task 59) — validation copy, the success/MFA/401/429
 * flows, the open-redirect guard, the OAuth start URL, the eye toggle and the
 * `?error=` toast mapping. Logins run through the real api client against the
 * MSW auth handler (fixture people only: the client profile and Reed, the
 * MFA-enrolled staff member).
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const [reed] = staffMembers;
if (reed === undefined) throw new Error('staffMembers fixture is empty.');

const locationAssign = vi.fn();
let queryClient: QueryClient;

function renderCard(props: Partial<Parameters<typeof LoginCard>[0]> = {}) {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginCard next={null} error={null} mfaRequested={false} {...props} />
    </QueryClientProvider>,
  );
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password'), 'password123');
}

beforeEach(() => {
  routerReplace.mockClear();
  locationAssign.mockClear();
  vi.stubGlobal('location', { ...window.location, assign: locationAssign });
  useToastStore.setState({ toasts: [] });
  useMfaDialogStore.setState({ open: false, email: '', methods: [], next: '/' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginCard — copy and layout', () => {
  it('renders the verbatim strings and links', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to access your security console.')).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT')).toBeInTheDocument();
    for (const label of ['Google', 'GitHub', 'Microsoft']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText('Keep me signed in on this device')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot Password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByText('Don’t have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/signup');
    expect(
      screen.getByText('Secured with 256-bit TLS · Zero-knowledge credential handling'),
    ).toBeInTheDocument();
    // Full page, not a dialog (planner note).
    expect(document.getElementById('vvLoginCard')?.tagName).toBe('MAIN');
    expect(document.getElementById('vvLoginCard')).not.toHaveAttribute('role');
  });
});

describe('LoginCard — validation', () => {
  it('empty submit shows both required messages', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('shows the malformed-email and short-password messages', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText('Email address'), 'nope@');
    await user.type(screen.getByLabelText('Password'), '1234567');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() =>
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument(),
    );
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('LoginCard — submit flow', () => {
  it('client login seeds the session cache and replaces to /portal', async () => {
    const user = userEvent.setup();
    renderCard();
    await fillCredentials(user, clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/portal'));
    expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({
      id: clientProfile.id,
    });
    expect(useMfaDialogStore.getState().open).toBe(false);
  });

  it('honours a safe ?next= path', async () => {
    const user = userEvent.setup();
    renderCard({ next: '/portal/billing' });
    await fillCredentials(user, clientProfile.email);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/portal/billing'));
  });

  it('staff login opens the MFA dialog store instead of navigating', async () => {
    const user = userEvent.setup();
    renderCard();
    await fillCredentials(user, reed.email);
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(useMfaDialogStore.getState().open).toBe(true));
    expect(useMfaDialogStore.getState()).toMatchObject({
      email: reed.email,
      methods: ['totp', 'webauthn', 'email_otp'],
      next: '/',
    });
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('401 toasts the neutral sign-in failure copy', async () => {
    const user = userEvent.setup();
    renderCard();
    await fillCredentials(user, 'stranger@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'crit',
      title: 'Sign-in failed',
      message: 'Incorrect email or password.',
    });
  });
});

describe('LoginCard — guards and returns', () => {
  it('safeNextPath accepts internal paths and rejects redirects', () => {
    expect(safeNextPath('/portal/billing')).toBe('/portal/billing');
    expect(safeNextPath('//evil.com')).toBeNull();
    expect(safeNextPath('/\\evil.com')).toBeNull();
    expect(safeNextPath('https://evil.com')).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath('')).toBeNull();
  });

  it('OAuth buttons build the exact provider start URL', async () => {
    const user = userEvent.setup();
    renderCard({ next: '/portal/billing' });
    await user.click(screen.getByRole('button', { name: 'GitHub' }));
    expect(locationAssign).toHaveBeenCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/github/start?next=%2Fportal%2Fbilling`,
    );
    await user.click(screen.getByRole('button', { name: 'Google' }));
    expect(locationAssign).toHaveBeenLastCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/google/start?next=%2Fportal%2Fbilling`,
    );
    await user.click(screen.getByRole('button', { name: 'Microsoft' }));
    expect(locationAssign).toHaveBeenLastCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/microsoft/start?next=%2Fportal%2Fbilling`,
    );
  });

  it('?mfa=1 opens the dialog with the pinned method list', () => {
    renderCard({ mfaRequested: true, next: '/admin' });
    expect(useMfaDialogStore.getState()).toMatchObject({
      open: true,
      email: '',
      methods: ['totp', 'webauthn'],
      next: '/admin',
    });
  });

  it('?error=oauth_not_allowed shows the mapped toast text', () => {
    renderCard({ error: 'oauth_not_allowed' });
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'Staff accounts must sign in with email and password.',
    });
  });
});

describe('LoginCard — eye toggle', () => {
  it('flips type, aria-pressed and aria-label', async () => {
    const user = userEvent.setup();
    renderCard();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    const eye = screen.getByRole('button', { name: 'Show password' });
    expect(eye).toHaveAttribute('aria-pressed', 'false');

    await user.click(eye);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
