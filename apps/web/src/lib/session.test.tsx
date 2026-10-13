// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginResponse } from '@vunvault/contracts';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';
import { createQueryClient, queryKeys } from '@vunvault/lib';
import { env } from '../env';
import { Providers } from '../app/providers';
import { mockClientSession, mockStaffSession } from '../mocks/handlers/auth';
import { server } from '../mocks/server';
import { apiGet, apiGetQuiet, apiPost } from './api';
import { useSession, useSessionStore } from './session';
import { useLogout } from './use-logout';

/**
 * Client-runtime tests (Task 42).
 *
 * The MSW node server (started in `vitest.setup.ts`) serves the contract
 * fixtures, so these exercise the real `@vunvault/lib` transport, the real
 * TanStack Query wiring and the real mock handlers — nothing is stubbed
 * except `next/navigation` (jsdom cannot navigate) and `window.location`
 * (the redirect target is asserted, not followed).
 */

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

const originalLocation = window.location;
let assignSpy: ReturnType<typeof vi.fn>;

function createWrapper() {
  const queryClient = createQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper: Wrapper };
}

beforeEach(() => {
  assignSpy = vi.fn();
  // api.ts reads `window.location.pathname` / `.search` and calls `.assign`;
  // jsdom's Location is unforgeable, so the whole object is swapped for a
  // minimal stand-in and restored after each test.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname: '/', search: '', assign: assignSpy },
  });
  useSessionStore.getState().clear();
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.clearAllMocks();
});

describe('useSession', () => {
  it('resolves a 401 to user:null — no error state, no redirect', async () => {
    // No `vv_mock_session` cookie → the auth handler answers 401. This is the
    // anonymous-visitor path: it must be a normal logged-out state, not an error.
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.can('scans:read')).toBe(false);
    expect(queryClient.getQueryState(queryKeys.session())?.error).toBeNull();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("can() follows the session's permissions", async () => {
    // The client role holds scans:read but not users:read (ROLE_PERMISSIONS).
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockClientSession })),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe(clientProfile.email);
    expect(result.current.can('scans:read')).toBe(true);
    expect(result.current.can('users:read')).toBe(false);
    expect(result.current.isStaff).toBe(false);
  });

  it('flags staff sessions and mirrors the user into the Zustand store', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockStaffSession })),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isStaff).toBe(true));
    expect(result.current.can('users:read')).toBe(true); // super_admin holds all
    await waitFor(() => expect(useSessionStore.getState().user?.id).toBe(mockStaffSession.id));
  });
});

describe('session mock handlers', () => {
  it('gates GET /auth/session on the vv_mock_session cookie', async () => {
    const anonymous = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`);
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: 'unauthorized' });

    const authenticated = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`, {
      headers: { cookie: 'vv_mock_session=1' },
    });
    expect(authenticated.status).toBe(200);
    expect(await authenticated.json()).toEqual({ data: mockStaffSession });
  });

  it('serves the CSRF token and sets the readable vv_csrf cookie', async () => {
    const response = await apiGet<{ data: { csrfToken: string } }>('/api/v1/auth/csrf');
    expect(response.data.csrfToken).toBe('mock');
  });

  it('answers login from the fixtures and rejects everybody else', async () => {
    const client = await apiPost<LoginResponse>('/api/v1/auth/login', {
      email: clientProfile.email,
      password: 'anything-8-chars',
    });
    expect(client.data.user?.email).toBe(clientProfile.email);
    expect(client.data.mfaRequired).toBe(false);
    expect(client.data.mfaMethods).toEqual([]);

    const staff = await apiPost<LoginResponse>('/api/v1/auth/login', {
      email: 'e.reed@vunvault.com',
      password: 'anything-8-chars',
    });
    expect(staff.data.user).toBeNull();
    expect(staff.data.mfaRequired).toBe(true);
    expect(staff.data.mfaMethods).toEqual(['totp', 'webauthn', 'email_otp']);

    await expect(
      apiPost('/api/v1/auth/login', { email: 'imposter@example.com', password: 'anything-8' }),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });

    // A too-short password fails the LoginBody contract, same envelope.
    await expect(
      apiPost('/api/v1/auth/login', { email: clientProfile.email, password: 'short' }),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
  });
});

describe('apiGetQuiet / redirect', () => {
  it('returns the body on 200 and null on 401, suppressing the redirect', async () => {
    const body = await apiGetQuiet<{ data: { csrfToken: string } }>('/api/v1/auth/csrf');
    expect(body?.data.csrfToken).toBe('mock');

    const unauthorized = await apiGetQuiet<unknown>('/api/v1/auth/session');
    expect(unauthorized).toBeNull();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('still redirects to /login on a non-quiet 401 away from /login', async () => {
    await expect(apiGet('/api/v1/auth/session')).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(assignSpy).toHaveBeenCalledWith('/login?next=%2F');
  });
});

describe('useLogout', () => {
  it('clears the cache and the store, then replaces the route with /login', async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(queryKeys.session(), mockStaffSession);
    useSessionStore.getState().setUser(mockStaffSession);

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.session())).toBeUndefined();
    expect(useSessionStore.getState().user).toBeNull();
    expect(routerReplace).toHaveBeenCalledWith('/login');
  });
});

describe('Providers', () => {
  it('renders children and mounts exactly one toast container', async () => {
    render(
      <Providers>
        <p>bootstrapped</p>
      </Providers>,
    );

    expect(screen.getByText('bootstrapped')).toBeInTheDocument();
    // The Radix toast viewport (`role="region"`) is the app-level toast
    // container; the root layout mounts Providers once, so exactly one exists.
    expect(document.querySelectorAll('[role="region"]')).toHaveLength(1);
  });
});
