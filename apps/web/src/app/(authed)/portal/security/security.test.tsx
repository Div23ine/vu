// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mfaStatus, securityPosture } from '@vunvault/contracts/fixtures/account';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import { ChangePasswordCard } from './_components/change-password-card';
import { RecoveryKeysCard } from './_components/recovery-keys-card';
import { TwoFactorCard } from './_components/two-factor-card';

/**
 * Password Manager & Security tests (Task 67) — the spec's list: the rule
 * checklist + strength transitions, mismatch and same-as-current errors, the
 * 401/422 mapping, TOTP enrolment (`<img>` QR + verify), the last-factor
 * disable error, WebAuthn registration hitting BOTH endpoints (with a mocked
 * `navigator.credentials`), and the recovery codes (ten shown once, Print
 * Codes → `window.print()`, the API-derived remaining-count line).
 *
 * The standing handlers come from `mocks/handlers/security.ts` (fixture
 * status: TOTP on, one YubiKey, 3/10 codes left); per-scenario overrides use
 * `server.use`.
 */

const sessionState = vi.hoisted(() => ({ isStaff: false }));

vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: true,
    isStaff: sessionState.isStaff,
    can: () => false,
    refetch: () => undefined,
  }),
}));

let queryClient: QueryClient;
const credentialsCreate = vi.hoisted(() => vi.fn());
const clipboardWrite = vi.hoisted(() => vi.fn());

function renderCard(card: React.ReactElement) {
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{card}</QueryClientProvider>);
}

/** GET /account/security with a custom MFA status. */
function mockSecurityStatus(mfa: Partial<typeof mfaStatus> = {}) {
  server.use(
    http.get('*/api/v1/account/security', () =>
      HttpResponse.json({
        data: { ...mfaStatus, ...mfa, posture: securityPosture },
      }),
    ),
  );
}

/**
 * `userEvent.setup()` installs its own `navigator.clipboard` stub over ours —
 * so the platform mocks are (re)installed AFTER every setup.
 */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'credentials', {
    value: { create: credentialsCreate },
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
  });
  return user;
}

function fakePublicKeyCredential() {
  return {
    id: 'cred-mock-1',
    rawId: new Uint8Array([1, 2, 3, 4]).buffer,
    type: 'public-key',
    response: {
      clientDataJSON: new Uint8Array([9, 9]).buffer,
      attestationObject: new Uint8Array([8, 8]).buffer,
    },
  };
}

beforeEach(() => {
  sessionState.isStaff = false;
  useToastStore.setState({ toasts: [] });
  credentialsCreate.mockReset();
  clipboardWrite.mockReset();
  clipboardWrite.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'credentials', {
    value: { create: credentialsCreate },
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
  });
  vi.spyOn(window, 'print').mockImplementation(() => undefined);
});

describe('ChangePasswordCard', () => {
  it('drives the rule checklist and the strength hints live', async () => {
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    expect(screen.getByText('Awaiting input')).toBeInTheDocument();
    expect(
      screen.getByText('Use 12+ characters with mixed cases, numbers and symbols.'),
    ).toBeInTheDocument();
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(rules.querySelectorAll('.vpm-rule.is-met')).toHaveLength(0);

    const field = screen.getByLabelText('New Password');
    await user.type(field, 'abc');
    expect(await screen.findByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('Too easy to guess — add length and variety.')).toBeInTheDocument();
    expect(rules.querySelectorAll('.vpm-rule.is-met')).toHaveLength(1); // lower

    await user.type(field, 'DEF5!ghijkl'); // 'abcDEF5!ghijkl' — 14 chars, all rules
    expect(await screen.findByText('Strong')).toBeInTheDocument();
    expect(
      screen.getByText('Excellent. This password resists brute-force well.'),
    ).toBeInTheDocument();
    expect(rules.querySelectorAll('.vpm-rule.is-met')).toHaveLength(5);
    // The visually hidden met/not-met words for screen readers.
    expect(within(rules).getAllByText('met')).toHaveLength(5);
  });

  it('blocks same-as-current and mismatched confirmation with the verbatim errors', async () => {
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    // Same-as-current: a rule-valid password identical to the current one.
    await user.type(screen.getByLabelText('Current Password'), 'Str0ng!Passw0rd');
    await user.type(screen.getByLabelText('New Password'), 'Str0ng!Passw0rd');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(await screen.findByText('New password must differ from current')).toBeInTheDocument();

    // Mismatch: a different rule-valid password with a non-matching confirm.
    await user.clear(screen.getByLabelText('New Password'));
    await user.type(screen.getByLabelText('New Password'), 'Different!Pass9');
    await user.clear(screen.getByLabelText('Confirm New Password'));
    await user.type(screen.getByLabelText('Confirm New Password'), 'Other!Pass123');
    expect(await screen.findByText('Passwords do not match yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('maps 401 to the current-password field and 422 to the breach message', async () => {
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    await user.type(screen.getByLabelText('Current Password'), 'not-my-password');
    await user.type(screen.getByLabelText('New Password'), 'Str0ng!Passw0rd');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Current Password'));
    await user.type(screen.getByLabelText('Current Password'), 'password123');
    await user.clear(screen.getByLabelText('New Password'));
    await user.type(screen.getByLabelText('New Password'), 'Breached!Pass1');
    await user.clear(screen.getByLabelText('Confirm New Password'));
    await user.type(screen.getByLabelText('Confirm New Password'), 'Breached!Pass1');
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(
      await screen.findByText(
        'This password has appeared in a data breach. Choose a different one.',
      ),
    ).toBeInTheDocument();
  });

  it('succeeds with the verbatim toast and clears the form', async () => {
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    await user.type(screen.getByLabelText('Current Password'), 'password123');
    await user.type(screen.getByLabelText('New Password'), 'Str0ng!Passw0rd');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Str0ng!Passw0rd');
    expect(await screen.findByText('✓ Passwords match.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Password updated successfully',
        message: 'All other sessions were signed out.',
      }),
    );
    expect(screen.getByLabelText('Current Password')).toHaveValue('');
    expect(screen.getByLabelText('New Password')).toHaveValue('');
  });

  it('enforces the 14-character staff minimum with the helper line', async () => {
    sessionState.isStaff = true;
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    expect(screen.getByText('Staff accounts require at least 14 characters.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Current Password'), 'password123');
    // 13 chars, every character class present — one short of the staff rule.
    await user.type(screen.getByLabelText('New Password'), 'Str0ng!Passw1');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Str0ng!Passw1');
    await user.click(screen.getByRole('button', { name: /Update Password/ }));
    expect(
      await screen.findByText('New password does not meet the requirements'),
    ).toBeInTheDocument();
  });

  it('Clear Fields resets the form', async () => {
    const user = setupUser();
    renderCard(<ChangePasswordCard />);
    await user.type(screen.getByLabelText('Current Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Clear Fields' }));
    expect(screen.getByLabelText('Current Password')).toHaveValue('');
    expect(screen.getByText('Awaiting input')).toBeInTheDocument();
  });
});

describe('TwoFactorCard — TOTP', () => {
  it('enrolment shows the <img> QR, the grouped key and verifies', async () => {
    mockSecurityStatus({ totp: { enabled: false, factorId: null } });
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    expect(await screen.findByText('Not enabled')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Authenticator app (TOTP)' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveTextContent('Off');

    await user.click(toggle);
    const qr = await screen.findByRole('img', { name: 'Authenticator QR code' });
    expect(qr.tagName).toBe('IMG');
    expect((qr as HTMLImageElement).src.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    expect(screen.getByText('“Add account”', { exact: false })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Verification Code'), '123456');
    await user.click(screen.getByRole('button', { name: /Verify & Enable/ }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Authenticator app enabled',
      }),
    );
  });

  it('short and wrong codes show the verbatim errors', async () => {
    mockSecurityStatus({ totp: { enabled: false, factorId: null } });
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    await user.click(await screen.findByRole('switch', { name: 'Authenticator app (TOTP)' }));
    await screen.findByRole('img', { name: 'Authenticator QR code' });

    await user.type(screen.getByLabelText('Verification Code'), '12');
    await user.click(screen.getByRole('button', { name: /Verify & Enable/ }));
    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Verification Code'));
    await user.type(screen.getByLabelText('Verification Code'), '000000');
    await user.click(screen.getByRole('button', { name: /Verify & Enable/ }));
    expect(await screen.findByText('Incorrect code.')).toBeInTheDocument();
  });

  it('Copy puts the raw secret on the clipboard with the verbatim toast', async () => {
    mockSecurityStatus({ totp: { enabled: false, factorId: null } });
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    await user.click(await screen.findByRole('switch', { name: 'Authenticator app (TOTP)' }));
    await screen.findByRole('img', { name: 'Authenticator QR code' });
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP'));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Copied to clipboard',
    });
  });

  it('disabling the LAST factor surfaces the verbatim 422 message', async () => {
    // Fixture status: TOTP enabled, and this scenario removes the hardware key.
    mockSecurityStatus({ webauthn: { keys: [] } });
    server.use(
      http.delete('*/api/v1/account/mfa/totp', () =>
        HttpResponse.json({ error: 'last_factor' }, { status: 422 }),
      ),
    );
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    const toggle = await screen.findByRole('switch', { name: 'Authenticator app (TOTP)' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);

    // Confirmation dialog (Radix) with the verbatim copy.
    expect(await screen.findByText('Disable authenticator app?')).toBeInTheDocument();
    expect(screen.getByText('You will rely on your other methods to sign in.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Disable/ }));
    expect(
      await screen.findByText('You cannot remove your only second factor.'),
    ).toBeInTheDocument();
  });
});

describe('TwoFactorCard — hardware keys', () => {
  it('Register Key calls options AND verify, then toasts', async () => {
    let optionsCalls = 0;
    let verifyBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/api/v1/account/mfa/webauthn/register/options', () => {
        optionsCalls += 1;
        return HttpResponse.json({
          data: {
            challenge: 'Y2hhbGxlbmdlLXRlc3Q',
            rp: { name: 'VUNVAULT' },
            user: { id: 'dXNlci1pZC1tb2Nr', name: 'jane@example.com', displayName: 'Jane' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          },
        });
      }),
      http.post('*/api/v1/account/mfa/webauthn/register/verify', async ({ request }) => {
        verifyBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            data: {
              id: '30000000-0000-4000-8000-000000000003',
              deviceName: null,
              createdAt: '2026-10-08T12:00:00Z',
              lastUsedAt: null,
            },
          },
          { status: 201 },
        );
      }),
    );
    credentialsCreate.mockResolvedValue(fakePublicKeyCredential());
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    expect(await screen.findByText('YubiKey 5C NFC')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Register Key/ }));
    await waitFor(() => expect(optionsCalls).toBe(1));
    await waitFor(() => expect(credentialsCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(verifyBody).not.toBeNull());
    const credential = (verifyBody as unknown as { credential: Record<string, unknown> })
      .credential;
    expect(credential).toMatchObject({ id: 'cred-mock-1', type: 'public-key' });
    // Base64url, never raw buffers on the wire.
    expect(typeof credential.rawId).toBe('string');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Hardware security key registered',
    });
  });

  it('a user cancel keeps the panel with the verbatim sentence', async () => {
    credentialsCreate.mockRejectedValue(
      Object.assign(new Error('The user does not wish to proceed.'), {
        name: 'NotAllowedError',
      }),
    );
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    await screen.findByText('YubiKey 5C NFC');
    await user.click(screen.getByRole('button', { name: /Register Key/ }));
    expect(await screen.findByText('Security key registration was cancelled.')).toBeInTheDocument();
  });

  it('Remove deletes the key and toasts', async () => {
    let removedId: string | null = null;
    server.use(
      http.delete('*/api/v1/account/mfa/webauthn/:id', ({ params }) => {
        removedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = setupUser();
    renderCard(<TwoFactorCard />);
    await screen.findByText('YubiKey 5C NFC');
    await user.click(screen.getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(removedId).toBe('30000000-0000-4000-8000-000000000001'));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Hardware key removed',
    });
  });
});

describe('RecoveryKeysCard', () => {
  it('the API-derived status line shows the remaining count', async () => {
    renderCard(<RecoveryKeysCard />);
    // Fixture: generated 2026-08-12, 3 of 10 remaining.
    expect(await screen.findByText(/· 3 of 10 unused/)).toBeInTheDocument();
    expect(screen.getByText('Emergency Backup Codes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Print Codes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerate/ })).toBeInTheDocument();
  });

  it('generates ten codes shown once, copies and prints them', async () => {
    mockSecurityStatus({
      recovery: { generated: false, remaining: 0, total: 10, generatedAt: null },
    });
    const user = setupUser();
    renderCard(<RecoveryKeysCard />);
    expect(await screen.findByText('No recovery keys generated yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Generate a set of 10 single-use emergency codes. Each code can be used exactly once to regain access to your account.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Generate Recovery Keys/ }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: '10 recovery keys generated',
      }),
    );
    const codes = document.querySelectorAll('.vpm-code-row code');
    expect(codes).toHaveLength(10);
    expect(codes[0]?.textContent).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(screen.getByText('Generated just now · 10 of 10 unused')).toBeInTheDocument();
    expect(
      screen.getByText(
        'These codes are shown once. Print them, store them in a safe, and never share them — anyone with a code can bypass your two-factor authentication.',
      ),
    ).toBeInTheDocument();

    // Per-code copy buttons.
    await user.click(screen.getByRole('button', { name: 'Copy recovery code 1' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('A1B2-C3D4-E5F6'));
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      kind: 'ok',
      title: 'Recovery code copied',
    });

    // Print Codes → window.print + the verbatim preparing toast.
    await user.click(screen.getByRole('button', { name: /Print Codes/ }));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      kind: 'info',
      title: 'Preparing printable sheet…',
    });

    // Hide Codes destroys the plaintext — once hidden, they are NOT retrievable.
    await user.click(screen.getByRole('button', { name: /Hide Codes/ }));
    expect(document.querySelectorAll('.vpm-code-row code')).toHaveLength(0);
    expect(await screen.findByText('No recovery keys generated yet')).toBeInTheDocument();
  });

  it('Regenerate goes through the irreversible-action dialog', async () => {
    const user = setupUser();
    renderCard(<RecoveryKeysCard />);
    await screen.findByText(/· 3 of 10 unused/);
    await user.click(screen.getByRole('button', { name: /Regenerate/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Irreversible action')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: 'Regenerate Recovery Keys?' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Your existing 10 recovery codes will be permanently invalidated the moment new ones are created. Any printed copies you hold will stop working.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Confirm only if you have lost your codes or suspect they may have leaked.',
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Yes, Regenerate/ }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'New recovery keys generated',
      }),
    );
    expect(screen.getByText('Regenerated just now · 10 of 10 unused')).toBeInTheDocument();
    // The regenerated batch is the reversed mock batch.
    expect(document.querySelectorAll('.vpm-code-row code')[0]?.textContent).toBe('G1H2-J3K4-L5M6');
  });
});
