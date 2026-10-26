// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createQueryClient } from '@vunvault/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server';
import LoginPage from './login/page';
import LoginConfirmPage from './login/confirm/page';
import SignupPage from './signup/page';

/**
 * Passwordless web flow tests: email step -> mailed-link notice -> code step,
 * and the confirm route exchanging the token for the code step. Success on
 * the code leg lands the visitor on the home page, authenticated by cookies
 * the API set.
 */

const replaceSpy = vi.fn();
const paramsState = vi.hoisted(() => ({
  step: null as string | null,
  handle: null as string | null,
  token: 'tok-1234567890' as string | null,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceSpy, push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => paramsState[key as 'step' | 'handle' | 'token'],
  }),
  usePathname: () => '/login',
}));

beforeEach(() => {
  paramsState.step = null;
  paramsState.handle = null;
  replaceSpy.mockClear();
});

function renderWithProviders(element: React.ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{element}</QueryClientProvider>);
}

describe('passwordless login page', () => {
  it('walks email -> sent notice -> code -> home', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    server.use(
      http.post('*/api/v1/auth/login', async () => {
        calls.push('start');
        return HttpResponse.json({}, { status: 202 });
      }),
      http.post('*/api/v1/auth/login/verify', async () => {
        calls.push('verify');
        return HttpResponse.json({ data: { id: 'u1', email: 'member@example.test' } });
      }),
    );
    renderWithProviders(<LoginPage searchParams={Promise.resolve({})} />);
    await user.type(screen.getByLabelText('Email address'), 'member@example.test');
    await user.click(screen.getByRole('button', { name: /Email me a sign-in link/ }));
    expect(await screen.findByText(/confirmation link is on its way/)).toBeInTheDocument();
    expect(calls).toEqual(['start']);

    // The confirm route hands back the handle; simulate arriving at the code step.
    paramsState.step = 'code';
    paramsState.handle = 'handle-abcdef123456';
    renderWithProviders(<LoginPage searchParams={Promise.resolve({})} />);
    expect(screen.getByLabelText(/Six-digit code from your email/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Six-digit code from your email/), '424242');
    await user.click(screen.getByRole('button', { name: /Verify and sign in/ }));
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/'));
    expect(calls).toEqual(['start', 'verify']);
  });

  it('shows a visible error when verification rejects the code', async () => {
    const user = userEvent.setup();
    paramsState.step = 'code';
    paramsState.handle = 'handle-abcdef123456';
    server.use(
      http.post('*/api/v1/auth/login/verify', () =>
        HttpResponse.json({ error: 'mfa_failed' }, { status: 401 }),
      ),
    );
    renderWithProviders(<LoginPage searchParams={Promise.resolve({})} />);
    await user.type(screen.getByLabelText(/Six-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: /Verify and sign in/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});

describe('login confirm route', () => {
  it('exchanges the emailed token for the code step', async () => {
    server.use(
      http.post('*/api/v1/auth/login/confirm', async () =>
        HttpResponse.json({ data: { handle: 'handle-abcdef123456', method: 'email' } }),
      ),
    );
    renderWithProviders(<LoginConfirmPage />);
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith(
        '/login?step=code&handle=handle-abcdef123456&method=email',
      ),
    );
  });
});

describe('passwordless signup page', () => {
  it('collects name and email, then explains the mailed link', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/signup', async () =>
        HttpResponse.json({ data: { email: 'new@example.test' } }, { status: 202 }),
      ),
    );
    renderWithProviders(<SignupPage />);
    await user.type(screen.getByLabelText('Full name'), 'New Person');
    await user.type(screen.getByLabelText('Email address'), 'new@example.test');
    await user.click(screen.getByRole('button', { name: /confirmation link/ }));
    expect(
      await screen.findByText(/confirmation link is on its way|If new@example.test is free/),
    ).toBeInTheDocument();
  });
});
