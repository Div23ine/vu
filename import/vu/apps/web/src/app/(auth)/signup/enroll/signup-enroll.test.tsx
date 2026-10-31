import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { server } from '../../../../mocks/server';
import SignupEnrollPage from './page';

/**
 * Signup step 4 — the QR / long-code onboarding wizard.
 *
 * Runs the real page and the real security hooks against the MSW node
 * server (mocks/handlers/security.ts: enrol answers a fixed challenge,
 * verify accepts `123456` and answers 401 `mfa_failed` otherwise), so the
 * transport is exercised too — including the quiet POST that keeps a wrong
 * code inside the wizard instead of triggering the global session-expiry
 * redirect. Only `next/navigation` and `window.location` are stubbed
 * (jsdom cannot navigate; the redirect target is asserted, not followed).
 */

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

/** The fixed challenge served by the security mock handler. */
const MOCK_SECRET = 'JBSWY3DPEHPK3PXP';
const QR_ALT = 'QR code that adds VUNVAULT to your authenticator app';

const originalLocation = window.location;
let assignSpy: ReturnType<typeof vi.fn>;

function renderWizard() {
  const queryClient = createQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<SignupEnrollPage />, { wrapper: Wrapper });
}

beforeEach(() => {
  assignSpy = vi.fn();
  // lib/api.ts reads `window.location.pathname` for the auth-flow guard and
  // would call `.assign` on session expiry; jsdom's Location is unforgeable,
  // so the whole object is swapped for a minimal stand-in (session.test pattern).
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname: '/signup/enroll', search: '', assign: assignSpy },
  });
  routerReplace.mockClear();
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe('signup step 4 — authenticator onboarding wizard', () => {
  it('provisions the challenge on arrival and shows the QR plus the long code', async () => {
    renderWizard();

    const qr = await screen.findByAltText(QR_ALT);
    expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/svg'));
    expect(screen.getByText(MOCK_SECRET)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /added it/i })).toBeInTheDocument();
    // The wizard does not ask for a code until the member says they scanned.
    expect(screen.queryByLabelText('Six digits from your app')).not.toBeInTheDocument();
  });

  it('walks scan → verify → done and exits to the dashboard', async () => {
    const user = userEvent.setup();
    let verifiedBody: unknown = null;
    server.use(
      http.post('*/api/v1/account/mfa/totp/verify', async ({ request }) => {
        verifiedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWizard();
    await screen.findByAltText(QR_ALT);

    await user.click(screen.getByRole('button', { name: /added it/i }));
    await user.type(screen.getByLabelText('Six digits from your app'), '123456');
    await user.click(screen.getByRole('button', { name: /verify and enable/i }));

    expect(await screen.findByText('Two-factor authentication is on')).toBeInTheDocument();
    expect(verifiedBody).toEqual({ factorId: 'factor-mock-totp-01', code: '123456' });
    await user.click(screen.getByRole('button', { name: /continue to dashboard/i }));
    expect(routerReplace).toHaveBeenCalledWith('/');
  });

  it('keeps a wrong code inside the wizard — no redirect to /login', async () => {
    const user = userEvent.setup();
    renderWizard();
    await screen.findByAltText(QR_ALT);

    await user.click(screen.getByRole('button', { name: /added it/i }));
    await user.type(screen.getByLabelText('Six digits from your app'), '654321');
    await user.click(screen.getByRole('button', { name: /verify and enable/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not match/i);
    expect(screen.getByLabelText('Six digits from your app')).toBeInTheDocument();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('offers the escape hatch back to the dashboard', async () => {
    renderWizard();
    await screen.findByAltText(QR_ALT);

    const skip = screen.getByRole('link', { name: /set up later/i });
    expect(skip).toHaveAttribute('href', '/');
  });
});
