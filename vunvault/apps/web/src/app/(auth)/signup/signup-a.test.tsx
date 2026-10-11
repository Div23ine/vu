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
import { server } from '../../../mocks/server';
import { env } from '../../../env';
import { SignupCard, SIGNUP_COUNTRIES } from './_components/signup-card';
import { useSignupStore } from './_store/signup-store';

/**
 * Signup page A tests (Task 61) — validation copy, the country list, the
 * account-type radios, the strength-meter label transitions, and the submit
 * outcomes (202 → dialog store, 409/422 → field errors, 429 → toast).
 *
 * The mock layer has no standing `POST /auth/signup` handler (Task 61's
 * deliverables do not touch it), so every submit test registers one with
 * `server.use(...)` — exactly the per-test variation `vitest.setup.ts`
 * prescribes.
 */

/** The spec's canonical strong password (12+, upper, lower, digit, symbol). */
const STRONG_PASSWORD = 'Str0ng!Passw0rd';

let queryClient: QueryClient;

function renderCard() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupCard />
    </QueryClientProvider>,
  );
}

/** Fill every required field with valid values (override per test). */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{
    fullName: string;
    phone: string;
    email: string;
    country: string;
    password: string;
    confirmPassword: string;
  }> = {},
) {
  if (overrides.fullName !== undefined) {
    await user.type(screen.getByLabelText('Full name'), overrides.fullName);
  } else {
    await user.type(screen.getByLabelText('Full name'), 'Jane Wanjiru');
  }
  if (overrides.email !== undefined) {
    await user.type(screen.getByLabelText('Email address'), overrides.email);
  } else {
    await user.type(screen.getByLabelText('Email address'), 'jane@example.com');
  }
  if (overrides.phone !== undefined) {
    await user.type(screen.getByLabelText('Phone number'), overrides.phone);
  }
  await user.selectOptions(
    screen.getByLabelText('Country'),
    overrides.country ?? SIGNUP_COUNTRIES[0]!.code,
  );
  await user.type(screen.getByLabelText('Password'), overrides.password ?? STRONG_PASSWORD);
  await user.type(
    screen.getByLabelText('Confirm password'),
    overrides.confirmPassword ?? STRONG_PASSWORD,
  );
}

function mockSignup(responder: Parameters<typeof server.use>[0]): void {
  server.use(responder);
}

const signupOk = http.post('*/api/v1/auth/signup', () =>
  HttpResponse.json(
    {
      data: {
        email: 'jane@example.com',
        verificationRequired: true,
        resendAfterSeconds: 30,
        expiresInSeconds: 600,
      },
    },
    { status: 202 },
  ),
);

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
  useToastStore.setState({ toasts: [] });
  useSignupStore.setState({ open: false, email: '', fullName: '' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignupCard — copy and layout', () => {
  it('renders the verbatim strings, brand and links', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(
      screen.getByText('Join the platform that finds the cracks before they do.'),
    ).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT')).toBeInTheDocument();
    for (const label of ['Google', 'GitHub', 'Microsoft']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByText('256-bit encrypted · 2FA protected')).toBeInTheDocument();
    // Full page, not a dialog (Task 59 planner note for this card family).
    expect(document.getElementById('vvSignupCard')?.tagName).toBe('MAIN');
    expect(document.getElementById('vvSignupCard')).not.toHaveAttribute('role');
  });

  it('renders the placeholders from the prototype', () => {
    renderCard();
    expect(screen.getByLabelText('Full name')).toHaveAttribute('placeholder', 'Jane Wanjiru');
    expect(screen.getByLabelText('Phone number')).toHaveAttribute(
      'placeholder',
      '+254 705 998 032',
    );
    expect(screen.getByLabelText('Email address')).toHaveAttribute(
      'placeholder',
      'you@company.com',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'placeholder',
      'At least 12 characters',
    );
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
      'placeholder',
      'Re-enter your password',
    );
  });

  it('starts the OAuth handshake with next=/onboarding', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Google' }));
    expect(location.assign).toHaveBeenCalledWith(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/auth/oauth/google/start?next=%2Fonboarding`,
    );
  });
});

describe('SignupCard — country list', () => {
  it('shows the placeholder option plus the 18 verbatim countries in order', () => {
    renderCard();
    const select = screen.getByLabelText('Country');
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(19);
    expect(options[0]).toHaveTextContent('Select country…');
    expect(options[0]).toBeDisabled();
    expect(options.slice(1).map((option) => option.textContent)).toEqual([
      'Kenya',
      'Uganda',
      'Tanzania',
      'Rwanda',
      'Nigeria',
      'Ghana',
      'South Africa',
      'Egypt',
      'Ethiopia',
      'United States',
      'United Kingdom',
      'Canada',
      'Germany',
      'France',
      'India',
      'United Arab Emirates',
      'Australia',
      'Other',
    ]);
    // `Other` carries the contract-legal 2-letter code.
    expect(options[18]).toHaveValue('XX');
    expect(options[1]).toHaveValue('KE');
  });
});

describe('SignupCard — account type radios', () => {
  it('offers Individual and Company cards and switches between them', async () => {
    const user = userEvent.setup();
    renderCard();
    const group = screen.getByRole('group', { name: 'Account type' });
    const individual = within(group).getByRole('radio', { name: /Individual/ });
    const company = within(group).getByRole('radio', { name: /Company/ });
    expect(within(group).getByText('Personal account')).toBeInTheDocument();
    expect(within(group).getByText('Team / organisation')).toBeInTheDocument();
    // Planner decision: the group defaults to Individual (no required copy).
    expect(individual).toBeChecked();
    await user.click(company);
    expect(company).toBeChecked();
    expect(individual).not.toBeChecked();
  });
});

describe('SignupCard — validation messages', () => {
  it('empty submit shows every required message and the check-details toast', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please select your country.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Password must be at least 12 characters and include upper and lower case letters, a number and a symbol.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument();
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'Check your details',
      message: 'Some fields need your attention before we can continue.',
    });
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a malformed phone number with the verbatim message', async () => {
    const user = userEvent.setup();
    renderCard();
    await fillForm(user, { phone: 'not-a-phone' });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument();
  });

  it('accepts the spaced international placeholder format', async () => {
    const user = userEvent.setup();
    renderCard();
    mockSignup(signupOk);
    await fillForm(user, { phone: '+254 705 998 032' });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(useSignupStore.getState().open).toBe(true));
    expect(screen.queryByText('Enter a valid phone number.')).not.toBeInTheDocument();
  });

  it('shows the mismatch message when the passwords differ', async () => {
    const user = userEvent.setup();
    renderCard();
    await fillForm(user, { confirmPassword: 'Different!Pass1' });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('SignupCard — strength meter', () => {
  it('walks the label through every score level as the user types', async () => {
    const user = userEvent.setup();
    renderCard();
    // Level 0 — the scorer's empty-state label.
    expect(screen.getByText('Awaiting input')).toBeInTheDocument();
    const password = screen.getByLabelText('Password');
    // Contract scorer: score = min(4, max(1, satisfiedRules - 1)) — Fair needs
    // 3 rules, Good 4, Strong all 5 (len≥12, upper, lower, digit, symbol).

    await user.type(password, 'abc'); // 'abc' → lower only → Weak
    expect(await screen.findByText('Weak')).toBeInTheDocument();

    await user.type(password, 'D5'); // 'abcD5' → lower+upper+digit → Fair
    expect(await screen.findByText('Fair')).toBeInTheDocument();

    await user.type(password, '!'); // 'abcD5!' → +symbol → Good
    expect(await screen.findByText('Good')).toBeInTheDocument();

    await user.type(password, 'ghijkl'); // 'abcD5!ghijkl' → 12 chars, all 5 → Strong
    expect(await screen.findByText('Strong')).toBeInTheDocument();
    expect(document.querySelector('.vv-strength')).toHaveAttribute('data-level', '4');
  });
});

describe('SignupCard — submit outcomes', () => {
  it('202 parks the email in the store and opens the verification dialog', async () => {
    const user = userEvent.setup();
    renderCard();
    mockSignup(signupOk);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(useSignupStore.getState().open).toBe(true));
    expect(useSignupStore.getState()).toMatchObject({
      email: 'jane@example.com',
      fullName: 'Jane Wanjiru',
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('sends the contract body (normalised phone, XX country, company account)', async () => {
    const user = userEvent.setup();
    renderCard();
    const seen: unknown[] = [];
    mockSignup(
      http.post('*/api/v1/auth/signup', async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json(
          {
            data: {
              email: 'jane@example.com',
              verificationRequired: true,
              resendAfterSeconds: 30,
              expiresInSeconds: 600,
            },
          },
          { status: 202 },
        );
      }),
    );
    await fillForm(user, { phone: '+254 705 998 032', country: 'XX' });
    await user.click(
      within(screen.getByRole('group', { name: 'Account type' })).getByRole('radio', {
        name: /Company/,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(useSignupStore.getState().open).toBe(true));
    expect(seen[0]).toMatchObject({
      fullName: 'Jane Wanjiru',
      email: 'jane@example.com',
      phone: '+254705998032',
      country: 'XX',
      accountType: 'company',
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    });
  });

  it('409 email_taken becomes a field error on email', async () => {
    const user = userEvent.setup();
    renderCard();
    mockSignup(
      http.post('*/api/v1/auth/signup', () =>
        HttpResponse.json({ error: 'email_taken' }, { status: 409 }),
      ),
    );
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(useSignupStore.getState().open).toBe(false);
  });

  it('422 breached_password becomes a field error on password', async () => {
    const user = userEvent.setup();
    renderCard();
    mockSignup(
      http.post('*/api/v1/auth/signup', () =>
        HttpResponse.json({ error: 'breached_password' }, { status: 422 }),
      ),
    );
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(
      await screen.findByText(
        'This password has appeared in a data breach. Choose a different one.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(useSignupStore.getState().open).toBe(false);
  });

  it('429 toasts the rate-limit copy', async () => {
    const user = userEvent.setup();
    renderCard();
    mockSignup(
      http.post('*/api/v1/auth/signup', () =>
        HttpResponse.json({ error: 'rate_limited' }, { status: 429 }),
      ),
    );
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'Too many attempts',
      message: 'Please wait a few minutes before trying again.',
    });
    expect(useSignupStore.getState().open).toBe(false);
  });
});

describe('SignupCard — password visibility toggles', () => {
  it('flip type, aria-pressed and aria-label on both password fields', async () => {
    const user = userEvent.setup();
    renderCard();
    const toggles = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggles).toHaveLength(2);

    await user.click(toggles[0]!);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
