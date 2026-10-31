// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@vunvault/contracts';
import { createQueryClient, queryKeys } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import { mockStaffSession } from '../../../mocks/handlers/auth';
import { MfaSetupPanel } from './_components/mfa-setup-panel';

/**
 * Forced first-sign-in MFA SETUP panel tests (Phase 2). Pinned here: the
 * options POST on mount (QR + grouped secret, never injected as markup), the
 * visible mm:ss administrator countdown driven by `deadlineEpochMs` ONLY
 * (untimed enrolment renders no timer and no abandon control), window expiry
 * and the abandon button both closing the window into the blocked notice,
 * the 410 `setup_expired` lazy block on any leg, 410 `challenge_expired`
 * toasting back to /login, the verbatim incorrect-code copy, and the success
 * path seeding the session cache before navigating to `next` (or
 * `homeFor(role)`).
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const ADMIN_USER: SessionUser = { ...mockStaffSession, role: 'admin' };

const MASKED_TO = 'da••••@vunvault.com';
const SECRET = 'JBSWY3DPEHPK3PXP';
const QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>';
const URI = `otpauth://totp/VUNVAULT:mock?secret=${SECRET}&issuer=VUNVAULT`;

let queryClient: QueryClient;
let optionsCalls: number;
let abandonCalls: number;
let lastVerifyBody: Record<string, unknown> | null;
let successUser: SessionUser;

function optionsPayload(deadlineEpochMs: number | null) {
  return {
    data: { factorId: 'mock-factor', qrCodeSvg: QR_SVG, secret: SECRET, uri: URI, deadlineEpochMs },
  };
}

function renderPanel(
  overrides: { deadlineEpochMs?: number | null; to?: string | null; next?: string | null } = {},
) {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MfaSetupPanel
        deadlineEpochMs={overrides.deadlineEpochMs === undefined ? null : overrides.deadlineEpochMs}
        to={overrides.to === undefined ? MASKED_TO : overrides.to}
        next={overrides.next === undefined ? null : overrides.next}
      />
    </QueryClientProvider>,
  );
}

/** Flush pending microtasks + timers under fake timers. */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function pasteCode(code: string) {
  const first = document.querySelector<HTMLInputElement>('.vv-otp-digit');
  expect(first).not.toBeNull();
  fireEvent.paste(first as HTMLInputElement, {
    clipboardData: { getData: () => code },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  routerReplace.mockClear();
  optionsCalls = 0;
  abandonCalls = 0;
  lastVerifyBody = null;
  successUser = ADMIN_USER;
  useToastStore.setState({ toasts: [] });

  server.use(
    http.post('*/api/v1/auth/mfa/setup/options', () => {
      optionsCalls += 1;
      return HttpResponse.json(optionsPayload(null));
    }),
    http.post('*/api/v1/auth/mfa/setup/verify', async ({ request }) => {
      lastVerifyBody = (await request.json()) as Record<string, unknown>;
      const code = lastVerifyBody?.code;
      if (code === '123456') {
        return HttpResponse.json({ data: successUser });
      }
      return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
    }),
    http.post('*/api/v1/auth/mfa/setup/abandon', () => {
      abandonCalls += 1;
      return HttpResponse.json({ data: { blocked: true } });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MfaSetupPanel — untimed (normal-user) enrolment', () => {
  it('POSTs options on mount and renders the QR + grouped secret', async () => {
    renderPanel();
    await settle(20);

    expect(optionsCalls).toBe(1);
    const qr = screen.getByRole('img', { name: 'Authenticator QR code' }) as HTMLImageElement;
    expect(qr.src).toBe(`data:image/svg+xml;utf8,${encodeURIComponent(QR_SVG)}`);
    expect(document.getElementById('vvSetupSecret')).toHaveTextContent('JBSW Y3DP EHPK 3PXP');
    // The masked account is echoed, never the full email.
    expect(screen.getByText(/da••••@vunvault\.com/)).toBeInTheDocument();
  });

  it('renders no countdown and no abandon control without a deadline', async () => {
    renderPanel();
    await settle(20);

    expect(document.getElementById('vvSetupTimer')).toBeNull();
    expect(document.getElementById('vvSetupAbandon')).toBeNull();
    // Untimed enrolment keeps the plain way back.
    expect(document.getElementById('vvSetupBack')).toHaveAttribute('href', '/login');
  });
});

describe('MfaSetupPanel — timed (administrator) window', () => {
  it('shows the visible 5:00 countdown and it ticks down', async () => {
    renderPanel({ deadlineEpochMs: Date.now() + 300_000 });
    await settle(20);

    expect(screen.getByText('5:00')).toBeInTheDocument();
    expect(document.getElementById('vvSetupAbandon')).not.toBeNull();

    await settle(60_000);
    expect(screen.getByText('4:00')).toBeInTheDocument();

    // Under a minute the timer flips to its low-time state.
    await settle(181_000);
    expect(screen.getByText('0:59')).toBeInTheDocument();
    expect(document.getElementById('vvSetupTimer')).toHaveClass('is-low');
  });

  it('blocks when the countdown reaches zero', async () => {
    renderPanel({ deadlineEpochMs: Date.now() + 3_000 });
    await settle(20);

    await settle(3_500);
    expect(abandonCalls).toBe(1);
    expect(screen.getByRole('heading', { name: 'Setup window expired' })).toBeInTheDocument();
    expect(document.getElementById('vvSetupBlocked')).not.toBeNull();
  });

  it('blocks when the administrator abandons setup', async () => {
    renderPanel({ deadlineEpochMs: Date.now() + 300_000 });
    await settle(20);

    fireEvent.click(document.getElementById('vvSetupAbandon') as HTMLElement);
    await settle(20);

    expect(abandonCalls).toBe(1);
    expect(screen.getByRole('heading', { name: 'Setup window expired' })).toBeInTheDocument();
    // The abandon is recorded exactly once even though the timer is still running.
    await settle(60_000);
    expect(abandonCalls).toBe(1);
  });
});

describe('MfaSetupPanel — verify', () => {
  it('a correct code opens the full session and navigates after the success view', async () => {
    renderPanel({ deadlineEpochMs: Date.now() + 300_000 });
    await settle(20);

    pasteCode('123456');
    await settle(20);

    expect(lastVerifyBody).toMatchObject({ factorId: 'mock-factor', code: '123456' });
    expect(screen.getByText('Verification successful')).toBeVisible();
    expect(screen.getByText('Redirecting to VUNVAULT…')).toBeVisible();
    expect(routerReplace).not.toHaveBeenCalled();

    await settle(1400);
    // admin → /admin via homeFor; the session cache is seeded for instant /me.
    expect(routerReplace).toHaveBeenCalledWith('/admin');
    expect(queryClient.getQueryData(queryKeys.session())).toEqual(ADMIN_USER);
  });

  it('honours a sanitised ?next= over homeFor', async () => {
    renderPanel({ next: '/admin/profile' });
    await settle(20);

    pasteCode('123456');
    await settle(20);
    await settle(1400);

    expect(routerReplace).toHaveBeenCalledWith('/admin/profile');
  });

  it('an incorrect code shows the verbatim copy and clears the boxes', async () => {
    renderPanel();
    await settle(20);

    pasteCode('111111');
    await settle(20);

    expect(
      screen.getByText('Incorrect code. Please check the digits and try again.'),
    ).toBeInTheDocument();
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('.vv-otp-digit'));
    expect(boxes.every((box) => box.value === '')).toBe(true);
    // Still on the form — the window is untouched by a typo.
    expect(document.getElementById('vvSetupBlocked')).toBeNull();
  });

  it('a 410 setup_expired on verify closes the window into the blocked notice', async () => {
    server.use(
      http.post('*/api/v1/auth/mfa/setup/verify', () =>
        HttpResponse.json({ error: 'setup_expired' }, { status: 410 }),
      ),
    );
    renderPanel({ deadlineEpochMs: Date.now() + 300_000 });
    await settle(20);

    pasteCode('123456');
    await settle(20);

    expect(abandonCalls).toBe(1);
    expect(screen.getByRole('heading', { name: 'Setup window expired' })).toBeInTheDocument();
  });
});

describe('MfaSetupPanel — closed/expired windows on options', () => {
  it('410 setup_expired on mount renders the blocked notice without a form', async () => {
    server.use(
      http.post('*/api/v1/auth/mfa/setup/options', () =>
        HttpResponse.json({ error: 'setup_expired' }, { status: 410 }),
      ),
    );
    renderPanel({ deadlineEpochMs: Date.now() - 1_000 });
    await settle(20);

    expect(screen.getByRole('heading', { name: 'Setup window expired' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Authenticator QR code' })).toBeNull();
    expect(document.getElementById('vvSetupBlockedBack')).toHaveAttribute('href', '/login');
  });

  it('410 challenge_expired on mount toasts and returns to /login', async () => {
    server.use(
      http.post('*/api/v1/auth/mfa/setup/options', () =>
        HttpResponse.json({ error: 'challenge_expired' }, { status: 410 }),
      ),
    );
    renderPanel();
    await settle(20);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(routerReplace).toHaveBeenCalledWith('/login');
  });

  it('an unenrolled abandon (blocked: false) returns to /login', async () => {
    server.use(
      http.post('*/api/v1/auth/mfa/setup/abandon', () => {
        abandonCalls += 1;
        return HttpResponse.json({ data: { blocked: false } });
      }),
    );
    renderPanel({ deadlineEpochMs: Date.now() + 2_000 });
    await settle(20);

    await settle(2_500);
    expect(abandonCalls).toBe(1);
    expect(routerReplace).toHaveBeenCalledWith('/login');
    expect(document.getElementById('vvSetupBlocked')).toBeNull();
  });
});
