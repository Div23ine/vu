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
import { MfaDialog } from './_components/mfa-dialog';
import { useMfaDialogStore, type MfaUiMethod } from './_store/mfa-dialog-store';

/**
 * MFA dialog tests — the six-box UX (digits only, paste-and-submit
 * once, backspace navigation), the verbatim error copy, the success view and
 * navigation (including the staff recovery-login bounce), the method
 * switcher, Escape, the resend cooldown (fake timers) and the WebAuthn path
 * with a mocked `navigator.credentials`.
 *
 * The MFA endpoints live in `server.use` overrides inside this file: an earlier iteration's
 * deliverables do not include the shared auth handler, and per-test routes
 * keep the failure paths (401/410/cancel) controllable.
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const CLIENT_USER: SessionUser = {
  id: 'd1000000-0000-4000-8000-000000000001',
  email: 'client@example.com',
  fullName: 'Test Client',
  role: 'client',
  orgId: null,
  permissions: [],
  mfaEnrolled: true,
};

const STAFF_USER: SessionUser = { ...CLIENT_USER, role: 'admin', fullName: 'Admin User' };

const credentialsGet = vi.hoisted(() => vi.fn());

let lastVerify: Record<string, unknown> | null = null;
let lastRecovery: Record<string, unknown> | null = null;
let emailOtpCalls = 0;
let optionsCalls = 0;
let successUser: SessionUser = CLIENT_USER;

let queryClient: QueryClient;

function renderDialog() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MfaDialog />
    </QueryClientProvider>,
  );
}

function openDialog(methods: MfaUiMethod[], overrides: { email?: string; next?: string } = {}) {
  act(() => {
    useMfaDialogStore.getState().openDialog({
      email: overrides.email ?? 'reed@example.com',
      methods,
      next: overrides.next ?? '/',
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

beforeEach(() => {
  vi.useFakeTimers();
  routerReplace.mockClear();
  credentialsGet.mockReset();
  lastVerify = null;
  lastRecovery = null;
  emailOtpCalls = 0;
  optionsCalls = 0;
  successUser = CLIENT_USER;
  useToastStore.setState({ toasts: [] });
  useMfaDialogStore.setState({ open: false, email: '', methods: [], next: '/' });
  document.body.classList.remove('vv-modal-open');

  // jsdom has no WebAuthn; the dialog only calls navigator.credentials.get.
  Object.defineProperty(navigator, 'credentials', {
    value: { get: credentialsGet },
    configurable: true,
  });

  server.use(
    http.post('*/api/v1/auth/mfa/verify', async ({ request }) => {
      lastVerify = (await request.json()) as Record<string, unknown>;
      const code = (lastVerify as { code?: unknown }).code;
      if (lastVerify?.method === 'webauthn' || code === '123456') {
        return HttpResponse.json({ data: successUser });
      }
      return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
    }),
    http.post('*/api/v1/auth/mfa/email-otp', () => {
      emailOtpCalls += 1;
      return HttpResponse.json({}, { status: 202 });
    }),
    http.post('*/api/v1/auth/mfa/webauthn/options', () => {
      optionsCalls += 1;
      return HttpResponse.json({
        data: {
          challenge: 'Y2hhbGxlbmdlLXRlc3Q', // base64url("challenge-test")
          rpId: 'vunvault.test',
          timeout: 60000,
          userVerification: 'preferred',
          allowCredentials: [],
        },
      });
    }),
    http.post('*/api/v1/auth/mfa/recovery', async ({ request }) => {
      lastRecovery = (await request.json()) as Record<string, unknown>;
      if (lastRecovery?.code === 'AAAA-BBBB-CCCC') {
        return HttpResponse.json({ data: successUser });
      }
      return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MfaDialog — OTP entry', () => {
  it('accepts digits only', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();

    const [first] = digitBoxes();
    if (first === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.change(first, { target: { value: 'a' } });
    expect(first).toHaveValue('');
    fireEvent.change(first, { target: { value: '5' } });
    expect(first).toHaveValue('5');
    expect(screen.getByRole('heading', { name: 'Verify it’s you' })).toBeVisible();
    expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeVisible();
  });

  it('paste of 123456 fills six boxes and submits once', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();

    const [first] = digitBoxes();
    if (first === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });
    expect(digitBoxes().map((box) => box.value)).toEqual(['1', '2', '3', '4', '5', '6']);

    await flush();
    expect(lastVerify).toEqual({ method: 'totp', code: '123456' });
    // Submitted exactly once (auto-submit on completion).
    expect(screen.getByText('Verification successful')).toBeVisible();
  });

  it('backspace on an empty box moves focus back and clears', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();

    const boxes = digitBoxes();
    const [first, second] = [boxes[0], boxes[1]];
    if (first === undefined || second === undefined) throw new Error('OTP boxes missing.');
    fireEvent.change(first, { target: { value: '7' } });
    second.focus();
    fireEvent.keyDown(second, { key: 'Backspace' });
    expect(document.activeElement).toBe(first);
    expect(first).toHaveValue('');
  });

  it('incomplete codes ask for all six digits', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();

    const boxes = digitBoxes();
    for (const [index, digit] of ['1', '2', '3', '4', '5'].entries()) {
      const box = boxes[index];
      if (box === undefined) throw new Error('box missing');
      fireEvent.change(box, { target: { value: digit } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await flush();
    expect(screen.getByText('Please enter all 6 digits.')).toBeVisible();
    expect(lastVerify).toBeNull();
  });

  it('a wrong code shows the verbatim error', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();

    const [first] = digitBoxes();
    if (first === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.paste(first, { clipboardData: { getData: () => '111111' } });
    await flush();
    expect(
      screen.getByText('Incorrect code. Please check the digits and try again.'),
    ).toBeVisible();
    expect(document.getElementById('vvOtpCard')).toHaveClass('vv-shake');
  });

  it('410 challenge_expired closes the dialog and toasts', async () => {
    server.use(
      http.post('*/api/v1/auth/mfa/verify', () =>
        HttpResponse.json({ error: 'challenge_expired' }, { status: 410 }),
      ),
    );
    renderDialog();
    openDialog(['totp']);
    await flush();
    const [first] = digitBoxes();
    if (first === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });
    await flush();
    expect(useMfaDialogStore.getState().open).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'Session expired',
      message: 'Please sign in again.',
    });
  });
});

describe('MfaDialog — success and navigation', () => {
  it('shows the success view, seeds the session and replaces to next', async () => {
    renderDialog();
    openDialog(['totp'], { next: '/portal/billing' });
    await flush();
    const [first] = digitBoxes();
    if (first === undefined) throw new Error('OTP boxes did not render.');
    fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });
    await flush();

    expect(screen.getByText('Verification successful')).toBeVisible();
    expect(screen.getByText('Redirecting to VUNVAULT…')).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });
    expect(routerReplace).toHaveBeenCalledWith('/portal/billing');
    expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({ id: CLIENT_USER.id });
    expect(useMfaDialogStore.getState().open).toBe(false);
  });

  it('a staff recovery login is sent to /login?error=mfa_required', async () => {
    successUser = STAFF_USER;
    renderDialog();
    openDialog(['totp']);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    await flush();
    fireEvent.change(screen.getByLabelText('Recovery code'), {
      target: { value: 'aaaa-bbbb-cccc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await flush();
    expect(lastRecovery).toEqual({ code: 'AAAA-BBBB-CCCC' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });
    expect(routerReplace).toHaveBeenCalledWith('/login?error=mfa_required');
  });
});

describe('MfaDialog — method switcher', () => {
  it('shows only the offered methods (recovery always available)', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();
    expect(screen.queryByRole('button', { name: 'Use authenticator app' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use security key' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Use a recovery code' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    await flush();
    expect(
      screen.getByText('Enter one of your 12-character recovery codes (XXXX-XXXX-XXXX).'),
    ).toBeVisible();
    expect(screen.getByLabelText('Recovery code')).toBeVisible();
  });

  it('switching to email OTP sends the code, masks the email and starts the cooldown', async () => {
    renderDialog();
    openDialog(['totp', 'email_otp']);
    await flush();
    expect(emailOtpCalls).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await flush();
    expect(emailOtpCalls).toBe(1);
    expect(screen.getByText('re••@example.com')).toBeVisible();
    expect(screen.getByText('Didn’t get the code?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
    expect(screen.getByText('Resend in 60s')).toBeInTheDocument();
  });
});

describe('MfaDialog — resend cooldown', () => {
  it('counts down 60 s and re-arms Resend', async () => {
    renderDialog();
    openDialog(['email_otp']);
    await flush();
    expect(emailOtpCalls).toBe(1);
    const resend = screen.getByRole('button', { name: 'Resend code' });
    expect(resend).toBeDisabled();
    expect(screen.getByText('Resend in 60s')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText('Resend in 30s')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(resend).toBeEnabled();
    expect(screen.queryByText(/Resend in/)).toBeNull();

    fireEvent.click(resend);
    await flush();
    expect(emailOtpCalls).toBe(2);
    expect(screen.getByText('Resend in 60s')).toBeInTheDocument();
  });
});

describe('MfaDialog — dismissal', () => {
  it('Escape closes and clears the store without calling the API', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();
    expect(document.body).toHaveClass('vv-modal-open');

    fireEvent.keyDown(document, { key: 'Escape' });
    await flush();
    expect(useMfaDialogStore.getState().open).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lastVerify).toBeNull();
  });

  it('Close verification and Back to sign in both dismiss', async () => {
    renderDialog();
    openDialog(['totp']);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(useMfaDialogStore.getState().open).toBe(false);

    openDialog(['totp']);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close verification' }));
    expect(useMfaDialogStore.getState().open).toBe(false);
  });
});

describe('MfaDialog — WebAuthn', () => {
  const assertionCredential = {
    id: 'cred-1',
    rawId: new Uint8Array([1, 2, 3]).buffer,
    type: 'public-key',
    response: {
      clientDataJSON: new Uint8Array([4, 5]).buffer,
      authenticatorData: new Uint8Array([6]).buffer,
      signature: new Uint8Array([7, 8]).buffer,
      userHandle: null,
    },
  };

  it('auto-prompts once: options endpoint → credentials.get → verify with the assertion', async () => {
    credentialsGet.mockResolvedValue(assertionCredential);
    renderDialog();
    openDialog(['webauthn']);
    await flush();

    expect(optionsCalls).toBe(1);
    expect(credentialsGet).toHaveBeenCalledTimes(1);
    const publicKey = credentialsGet.mock.calls[0]?.[0] as {
      publicKey: { challenge: ArrayBuffer; rpId?: string };
    };
    expect(publicKey.publicKey.rpId).toBe('vunvault.test');
    expect(new Uint8Array(publicKey.publicKey.challenge)).toEqual(
      new Uint8Array(Buffer.from('challenge-test', 'utf8')),
    );

    if (lastVerify === null) throw new Error('verify was not called');
    const verifyPayload = lastVerify as unknown as {
      method: string;
      assertion: { id: string; response: Record<string, string | null> };
    };
    expect(verifyPayload.method).toBe('webauthn');
    expect(verifyPayload.assertion.id).toBe('cred-1');
    expect(verifyPayload.assertion.response.clientDataJSON).toBe('BAU'); // base64url([4,5])
    expect(screen.getByText('Verification successful')).toBeVisible();
  });

  it('a cancelled security key stays on the dialog with the verbatim message', async () => {
    credentialsGet.mockRejectedValue(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    renderDialog();
    openDialog(['webauthn']);
    await flush();
    expect(screen.getByText('Security key request was cancelled.')).toBeVisible();
    expect(useMfaDialogStore.getState().open).toBe(true);
    expect(screen.getByText('Insert or tap your security key when prompted.')).toBeVisible();
  });
});
