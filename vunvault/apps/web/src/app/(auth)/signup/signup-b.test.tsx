// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@vunvault/contracts';
import { createQueryClient, queryKeys } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import { firstNameOf, SignupVerifyDialog } from './_components/signup-verify-dialog';
import { groupSecret } from './_hooks/use-verify-signup';
import { useSignupStore } from './_store/signup-store';

/**
 * Signup page B tests (Task 62) — step 1 (wrong / incomplete / expired /
 * exhausted OTP copy, success toast + session seed), step 2 (QR through an
 * `<img>` — never `innerHTML` — grouped secret, Copy toast, TOTP verify error
 * and success), step 3 (verbatim success copy, the 2.5 s redirect under fake
 * timers, `Go now`), the resend cooldown, Escape-only-on-step-1 and the
 * removal of every "Test mode" scaffolding.
 *
 * The signup verification endpoints live in `server.use` overrides inside this
 * file (Task 62's deliverables do not include the shared mock handlers), the
 * same per-test-route pattern Task 60's `mfa.test.tsx` established.
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const JANE: SessionUser = {
  id: 'd1000000-0000-4000-8000-000000000002',
  email: 'jane@example.com',
  fullName: 'Jane Wanjiru',
  role: 'client',
  orgId: null,
  permissions: [],
  mfaEnrolled: false,
};

const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const TOTP_ENROLL = {
  factorId: 'factor-signup-1',
  qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
  secret: TOTP_SECRET,
  uri: `otpauth://totp/VUNVAULT:jane@example.com?secret=${TOTP_SECRET}&issuer=VUNVAULT`,
};

/** OTP codes the mock honours: 123456 ok; 111111 invalid; 222222 exhausted; 333333 expired. */
const OTP_OK = '123456';
const TOTP_OK = '654321';

let queryClient: QueryClient;
let enrollCalls = 0;
let resendCalls = 0;
let lastVerifyBody: Record<string, unknown> | null = null;
let lastTotpBody: Record<string, unknown> | null = null;
const clipboardWrite = vi.hoisted(() => vi.fn());

function renderDialog() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupVerifyDialog />
    </QueryClientProvider>,
  );
}

function openFlow(overrides: { email?: string; fullName?: string } = {}) {
  act(() => {
    useSignupStore.getState().start({
      email: overrides.email ?? 'jane@example.com',
      fullName: overrides.fullName ?? 'Jane Wanjiru',
    });
  });
}

async function flush(ms = 20) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function digitBoxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('.vv-otp-digit'));
}

function enterOtp(code: string) {
  const boxes = digitBoxes();
  code.split('').forEach((digit, index) => {
    const box = boxes[index];
    if (box === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.change(box, { target: { value: digit } });
  });
}

/** Drive step 1 → step 2 with the good code. */
async function advanceToTotp() {
  enterOtp(OTP_OK);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  routerReplace.mockClear();
  clipboardWrite.mockReset();
  clipboardWrite.mockResolvedValue(undefined);
  enrollCalls = 0;
  resendCalls = 0;
  lastVerifyBody = null;
  lastTotpBody = null;
  useToastStore.setState({ toasts: [] });
  useSignupStore.setState({ open: false, email: '', fullName: '' });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
  });

  server.use(
    http.post('*/api/v1/auth/signup/verify-email', async ({ request }) => {
      lastVerifyBody = (await request.json()) as Record<string, unknown>;
      const code = lastVerifyBody?.code;
      if (code === OTP_OK) return HttpResponse.json({ data: JANE });
      if (code === '222222') return HttpResponse.json({ error: 'otp_exhausted' }, { status: 401 });
      if (code === '333333') return HttpResponse.json({ error: 'otp_expired' }, { status: 410 });
      return HttpResponse.json({ error: 'otp_invalid' }, { status: 401 });
    }),
    http.post('*/api/v1/auth/signup/resend', () => {
      resendCalls += 1;
      return HttpResponse.json({}, { status: 202 });
    }),
    http.post('*/api/v1/account/mfa/totp/enroll', () => {
      enrollCalls += 1;
      return HttpResponse.json({ data: TOTP_ENROLL }, { status: 201 });
    }),
    http.post('*/api/v1/account/mfa/totp/verify', async ({ request }) => {
      lastTotpBody = (await request.json()) as Record<string, unknown>;
      if (lastTotpBody?.code === TOTP_OK) return new HttpResponse(null, { status: 204 });
      return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SignupVerifyDialog — step 1 (email OTP)', () => {
  it('renders the verbatim copy, tracker and disabled controls; no Test mode', async () => {
    renderDialog();
    openFlow();
    await flush();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'verifyTitle');
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByText('We sent a 6-digit verification code to')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close verification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled();
    // Step tracker: Email → 2FA → Done, active marked.
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('2FA')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    const active = document.querySelector('[aria-current="step"]');
    expect(active?.textContent).toContain('Email');
    // The prototype's dev scaffolding must not exist.
    expect(screen.queryByText('Test mode')).not.toBeInTheDocument();
    expect(screen.queryByText(/Your email OTP is/)).not.toBeInTheDocument();
  });

  it('incomplete submit shows the verbatim incomplete message', async () => {
    renderDialog();
    openFlow();
    await flush();
    enterOtp('123');
    const form = document.getElementById('vvVerifyOtpForm');
    if (form === null) throw new Error('The OTP form did not render.');
    fireEvent.submit(form);
    await flush();
    expect(screen.getByText('Please enter all 6 digits.')).toBeInTheDocument();
    expect(lastVerifyBody).toBeNull();
  });

  it('a wrong code shows the verbatim invalid message', async () => {
    renderDialog();
    openFlow();
    await flush();
    enterOtp('111111'); // sixth digit auto-submits
    await flush();
    expect(lastVerifyBody).toMatchObject({ email: 'jane@example.com', code: '111111' });
    expect(screen.getByText('That code is incorrect. Please try again.')).toBeInTheDocument();
  });

  it('an expired code shows the verbatim expired message', async () => {
    renderDialog();
    openFlow();
    await flush();
    enterOtp('333333');
    await flush();
    expect(screen.getByText('That code has expired. Request a new one.')).toBeInTheDocument();
  });

  it('exhausted attempts disable the boxes until Resend', async () => {
    renderDialog();
    openFlow();
    await flush();
    enterOtp('222222');
    await flush();
    expect(
      screen.getByText('Too many incorrect attempts. Request a new code.'),
    ).toBeInTheDocument();
    expect(digitBoxes().every((box) => box.disabled)).toBe(true);

    // Rewind the cooldown, resend, and the boxes come back.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    await flush();
    expect(resendCalls).toBe(1);
    expect(digitBoxes().every((box) => box.disabled)).toBe(false);
  });

  it('the correct code seeds the session, toasts and advances to step 2', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();

    expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({ id: JANE.id });
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Email verified',
      message: "Now let's set up two-factor authentication.",
    });
    expect(screen.getByRole('heading', { name: 'Two-factor authentication' })).toBeInTheDocument();
    expect(enrollCalls).toBe(1);
  });

  it('Back closes and Escape closes on step 1', async () => {
    renderDialog();
    openFlow();
    await flush();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useSignupStore.getState().open).toBe(false);

    openFlow();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(useSignupStore.getState().open).toBe(false);
  });

  it('the resend countdown unlocks after 30s and toasts the verbatim copy', async () => {
    renderDialog();
    openFlow();
    await flush();
    expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    const resend = screen.getByRole('button', { name: 'Resend' });
    expect(resend).toBeEnabled();
    fireEvent.click(resend);
    await flush();
    expect(resendCalls).toBe(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Verification code sent',
      message: 'A fresh verification code was sent to jane@example.com',
    });
    expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled();
  });
});

describe('SignupVerifyDialog — step 2 (authenticator enrolment)', () => {
  it('renders the QR through an <img> data-URI — never innerHTML', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();

    const qr = screen.getByRole('img', { name: 'Authenticator QR code' });
    expect(qr.tagName).toBe('IMG');
    expect(qr).toHaveAttribute(
      'src',
      `data:image/svg+xml;utf8,${encodeURIComponent(TOTP_ENROLL.qrCodeSvg)}`,
    );
    // No SVG was injected as markup anywhere in the QR frame.
    expect(document.querySelector('.vv-verify-qr svg')).toBeNull();
    expect(screen.queryByText('Test mode')).not.toBeInTheDocument();
    expect(screen.queryByText(/Your authenticator code is/)).not.toBeInTheDocument();
    // Focus moved to the step heading.
    expect(screen.getByRole('heading', { name: 'Two-factor authentication' })).toHaveFocus();
  });

  it('shows the secret grouped in 4s and Copy toasts', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();

    expect(screen.getByText('Your 2FA secret key')).toBeInTheDocument();
    expect(screen.getByText(groupSecret(TOTP_SECRET))).toBeInTheDocument();
    expect(screen.getByText(groupSecret(TOTP_SECRET)).textContent).toBe('JBSW Y3DP EHPK 3PXP');
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flush();
    expect(clipboardWrite).toHaveBeenCalledWith(TOTP_SECRET);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      kind: 'ok',
      title: 'Secret copied',
    });
  });

  it('a short code shows the verbatim incomplete message without calling the API', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    await flush();
    expect(screen.getByText('Please enter the full 6-digit code.')).toBeInTheDocument();
    expect(lastTotpBody).toBeNull();
  });

  it('a wrong code shows the verbatim incorrect message', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    await flush();
    expect(lastTotpBody).toMatchObject({ factorId: 'factor-signup-1', code: '000000' });
    expect(screen.getByText('That authenticator code is incorrect.')).toBeInTheDocument();
  });

  it('Escape does NOT close on step 2 (enrolment is mandatory)', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useSignupStore.getState().open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Two-factor authentication' })).toBeInTheDocument();
  });

  it('the correct code advances to step 3 with the verbatim success view', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: TOTP_OK },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    await flush();

    expect(
      screen.getByRole('heading', { name: 'Account Created & Verified!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Welcome to VUNVAULT,', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(
      screen.getByText('. Your email and two-factor authentication are now active.', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Redirecting to your dashboard…')).toBeInTheDocument();
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      kind: 'ok',
      title: 'Account Created & Verified!',
      message: 'Two-factor authentication is now active on your account.',
    });
  });
});

describe('SignupVerifyDialog — step 3 (done)', () => {
  async function reachDone() {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: TOTP_OK },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Create Account' }));
    await flush();
  }

  it('redirects to /onboarding after the 2.5 s bar', async () => {
    await reachDone();
    expect(routerReplace).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(routerReplace).toHaveBeenCalledWith('/onboarding');
    expect(useSignupStore.getState().open).toBe(false);
  });

  it('Go now redirects immediately', async () => {
    await reachDone();
    fireEvent.click(screen.getByRole('button', { name: 'Go now' }));
    expect(routerReplace).toHaveBeenCalledWith('/onboarding');
    expect(useSignupStore.getState().open).toBe(false);
  });

  it('Escape does NOT close on step 3', async () => {
    await reachDone();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useSignupStore.getState().open).toBe(true);
  });
});

describe('SignupVerifyDialog — helpers', () => {
  it('firstNameOf falls back to the prototype placeholder', () => {
    expect(firstNameOf('Jane Wanjiru')).toBe('Jane');
    expect(firstNameOf('  Jane  ')).toBe('Jane');
    expect(firstNameOf('')).toBe('friend');
    expect(firstNameOf('   ')).toBe('friend');
  });

  it('the tracker marks completed steps done', async () => {
    renderDialog();
    openFlow();
    await flush();
    await advanceToTotp();
    const doneNodes = document.querySelectorAll('.vv-verify-step-node.is-done');
    expect(doneNodes).toHaveLength(1);
    expect(doneNodes[0]?.textContent).toContain('Email');
    const active = document.querySelector('.vv-verify-step-node.is-active');
    expect(within(active as HTMLElement).getByText('2FA')).toBeInTheDocument();
  });
});
