import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import SignupPage from './page';

/**
 * `/signup` — the passwordless details → link → code machine.
 *
 * Pins the same contract as the login page: no native constraint-validation
 * layer anywhere (every form `noValidate`, no `required`/`pattern` inputs —
 * the browser must never block a submit behind an invisible bubble), while
 * `aria-required` keeps the semantics and the app's own error panel stays the
 * single source of validation feedback. The happy path runs against the MSW
 * server: the details leg acknowledges with 202 and the code leg creates the
 * account, handing straight over to authenticator enrolment.
 */

const routerReplace = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => new Map<string, string>());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => ({ get: (key: string) => searchParams.get(key) ?? null }),
}));

const MOCK_HANDLE = 'mock-signup-handle-0123456789';

const originalLocation = window.location;
let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Base handlers cover login only; the signup legs are per-file variations
  // and `resetHandlers` (setup) unwinds them after each test.
  server.use(
    http.post('*/api/v1/auth/signup', async () => HttpResponse.json({}, { status: 202 })),
    http.post('*/api/v1/auth/signup/verify', async ({ request }) => {
      const body = (await request.json()) as { handle?: string; code?: string };
      if (body.handle !== MOCK_HANDLE || body.code !== '424242') {
        return HttpResponse.json({ error: 'signup_failed' }, { status: 401 });
      }
      return HttpResponse.json({ data: {} });
    }),
  );
  assignSpy = vi.fn();
  // lib/api.ts reads `window.location.pathname` for the auth-flow guard;
  // jsdom's Location is unforgeable, so swap the whole object (session.test
  // pattern) and assert redirects instead of following them.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname: '/signup', search: '', assign: assignSpy },
  });
  routerReplace.mockClear();
  searchParams.clear();
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe('signup — no invisible native constraints', () => {
  it('renders the details step with app-level validation only', () => {
    render(<SignupPage />);

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.noValidate).toBe(true);
    expect(form?.querySelector('[required]')).toBeNull();
    expect(form?.querySelector('[pattern]')).toBeNull();

    for (const label of ['Full name', 'Email address']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).not.toHaveAttribute('required');
    }
  });

  it('renders the code step with app-level validation only', () => {
    searchParams.set('step', 'code');
    searchParams.set('handle', MOCK_HANDLE);
    render(<SignupPage />);

    const form = document.querySelector('form');
    expect(form?.noValidate).toBe(true);
    expect(form?.querySelector('[required]')).toBeNull();
    expect(form?.querySelector('[pattern]')).toBeNull();

    const code = screen.getByLabelText('Six-digit code from your email');
    expect(code).toHaveAttribute('aria-required', 'true');
    expect(code).not.toHaveAttribute('required');
    expect(code).not.toHaveAttribute('pattern');
  });

  it('shows a visible error (not a browser bubble) for empty details', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.click(screen.getByRole('button', { name: /confirmation link/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('creates the account on a correct code and hands off to enrolment', async () => {
    const user = userEvent.setup();
    searchParams.set('step', 'code');
    searchParams.set('handle', MOCK_HANDLE);
    render(<SignupPage />);

    await user.type(screen.getByLabelText('Six-digit code from your email'), '424242');
    await user.click(screen.getByRole('button', { name: /verify and create my account/i }));

    expect(routerReplace).toHaveBeenCalledWith('/signup/enroll');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('keeps a wrong code on the page with a visible message', async () => {
    const user = userEvent.setup();
    searchParams.set('step', 'code');
    searchParams.set('handle', MOCK_HANDLE);
    render(<SignupPage />);

    await user.type(screen.getByLabelText('Six-digit code from your email'), '111111');
    await user.click(screen.getByRole('button', { name: /verify and create my account/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
