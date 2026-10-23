import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

/**
 * `/login` — the passwordless email → link → code machine.
 *
 * Two guarantees are pinned here. First, the forms carry no native
 * constraint-validation layer: every form is `noValidate` and no input wears
 * `required`/`pattern`, so the browser can never block a submit behind an
 * invisible bubble — validation is the app's own, rendered in the visible
 * error panel. Accessible semantics survive via `aria-required`. Second, the
 * app-level validation still fires and stays on the page (no navigation)
 * when the input is unusable, and a correct code against the MSW auth
 * handler signs the visitor in (`router.replace('/')`).
 */

const routerReplace = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => new Map<string, string>());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => ({ get: (key: string) => searchParams.get(key) ?? null }),
}));

const originalLocation = window.location;
let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assignSpy = vi.fn();
  // lib/api.ts reads `window.location.pathname` for the auth-flow guard;
  // jsdom's Location is unforgeable, so swap the whole object (session.test
  // pattern) and assert redirects instead of following them.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname: '/login', search: '', assign: assignSpy },
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

describe('login — no invisible native constraints', () => {
  it('renders the email step with app-level validation only', () => {
    render(<LoginPage />);

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.noValidate).toBe(true);
    expect(form?.querySelector('[required]')).toBeNull();
    expect(form?.querySelector('[pattern]')).toBeNull();

    const email = screen.getByLabelText('Email address');
    expect(email).toHaveAttribute('aria-required', 'true');
    expect(email).not.toHaveAttribute('required');
  });

  it('renders the code step with app-level validation only', () => {
    searchParams.set('step', 'code');
    searchParams.set('handle', 'mock-handle-abcdef123456');
    render(<LoginPage />);

    const form = document.querySelector('form');
    expect(form?.noValidate).toBe(true);
    expect(form?.querySelector('[required]')).toBeNull();
    expect(form?.querySelector('[pattern]')).toBeNull();

    const code = screen.getByLabelText('Six-digit code from your email');
    expect(code).toHaveAttribute('aria-required', 'true');
    expect(code).not.toHaveAttribute('required');
    expect(code).not.toHaveAttribute('pattern');
  });

  it('shows a visible error (not a browser bubble) for an empty email', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign-in link/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('verifies a correct code and signs the visitor in', async () => {
    const user = userEvent.setup();
    searchParams.set('step', 'code');
    searchParams.set('handle', 'mock-handle-abcdef123456');
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Six-digit code from your email'), '424242');
    await user.click(screen.getByRole('button', { name: /verify and sign in/i }));

    expect(routerReplace).toHaveBeenCalledWith('/');
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('keeps a wrong code on the page with a visible message', async () => {
    const user = userEvent.setup();
    searchParams.set('step', 'code');
    searchParams.set('handle', 'mock-handle-abcdef123456');
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Six-digit code from your email'), '111111');
    await user.click(screen.getByRole('button', { name: /verify and sign in/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
