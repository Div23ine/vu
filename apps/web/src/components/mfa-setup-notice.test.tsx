import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@vunvault/contracts';
import { MfaSetupNotice } from './mfa-setup-notice';

/**
 * The mandatory first-login enrolment popup (work order Task 2b).
 *
 * The behaviour worth pinning is the part that is easy to get subtly wrong: the
 * popup must be driven by the SERVER's deadline, must not be dismissible, and
 * must step aside on the enrolment screen itself. A countdown that can be
 * closed, or one that reads a value out of the query string, would satisfy the
 * wording of the work order and none of its intent.
 */

const useSessionMock = vi.fn();
const usePathnameMock = vi.fn(() => '/');
const refetchMock = vi.fn();

vi.mock('../lib/session', () => ({
  useSession: () => useSessionMock(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

const NOW = new Date('2026-03-01T12:00:00.000Z');
const DEADLINE_MS = NOW.getTime() + 187_000; // 3:07 remaining

function sessionWith(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'daniel@vunvault.com',
    role: 'admin',
    orgId: null,
    permissions: [],
    mfaEnrolled: false,
    mfaMethods: [],
    mfaSetupDeadline: new Date(DEADLINE_MS).toISOString(),
    ...overrides,
  } as SessionUser;
}

function mount(user: SessionUser | null = sessionWith()) {
  useSessionMock.mockReturnValue({
    user,
    isLoading: false,
    isAuthenticated: user !== null,
    isStaff: true,
    can: () => false,
    refetch: refetchMock,
  });
  return render(<MfaSetupNotice />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  usePathnameMock.mockReturnValue('/');
  refetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('MfaSetupNotice', () => {
  it('renders nothing for a visitor with no armed deadline', () => {
    mount(null);
    expect(screen.queryByTestId('mfa-setup-notice')).toBeNull();

    mount(sessionWith({ mfaSetupDeadline: null }));
    expect(screen.queryByTestId('mfa-setup-notice')).toBeNull();
  });

  it('renders the countdown once the session carries a deadline', () => {
    mount();
    expect(screen.getByTestId('mfa-setup-notice')).toBeInTheDocument();
    // 187s -> "3:07", zero-padded.
    expect(screen.getByTestId('mfa-setup-countdown')).toHaveTextContent('3:07');
  });

  it('ticks down on the server deadline, not on a client-supplied one', () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(7_000);
    });
    expect(screen.getByTestId('mfa-setup-countdown')).toHaveTextContent('3:00');
  });

  it('links to the enrolment screen carrying the server deadline and a safe next', () => {
    mount();
    const cta = screen.getByTestId('mfa-setup-cta');
    expect(cta).toHaveAttribute('href', `/login/mfa/setup?deadline=${DEADLINE_MS}&next=%2F`);
  });

  it('drops an unsafe current path from next rather than forwarding it', () => {
    usePathnameMock.mockReturnValue('//evil.example.com');
    mount();
    const href = screen.getByTestId('mfa-setup-cta').getAttribute('href') ?? '';
    expect(href).toBe(`/login/mfa/setup?deadline=${DEADLINE_MS}`);
    expect(href).not.toContain('evil.example.com');
  });

  it('cannot be dismissed — there is no close control', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
    // The only actionable control is the one that starts enrolment.
    expect(screen.getByTestId('mfa-setup-cta')).toBeInTheDocument();
  });

  it('steps aside on the enrolment screen, where the ceremony is already open', () => {
    usePathnameMock.mockReturnValue('/login/mfa/setup');
    mount();
    expect(screen.queryByTestId('mfa-setup-notice')).toBeNull();
  });

  it('switches to the closed-window state at zero and re-reads the session', () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(187_000);
    });

    // The countdown is gone: showing "0:00" next to a live-looking CTA would
    // invite a click the server is about to reject.
    expect(screen.queryByTestId('mfa-setup-countdown')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Setup window closed' })).toBeInTheDocument();
    // The API now rejects this session; refetching is what surfaces that
    // instead of leaving a live-looking session in the cache.
    expect(refetchMock).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/login');
  });

  it('never counts below zero', () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(600_000);
    });
    expect(screen.getByRole('heading', { name: 'Setup window closed' })).toBeInTheDocument();
  });
});
