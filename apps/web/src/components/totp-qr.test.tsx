import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TotpQr } from './totp-qr';
import { qrCodeSrc } from '../lib/qr';

/**
 * The shared enrolment QR component.
 *
 * The point of these tests is the two failure modes that produced the reported
 * "blank space or error state": a payload the browser cannot parse (the
 * double-wrapped data URI — see `lib/qr.ts`) and a load error nobody can see.
 */

const RAW_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="99" height="99"></svg>';
/** The real production shape: `@supabase/auth-js` `_enroll` wraps the SVG itself. */
const SDK_SHAPE = `data:image/svg+xml;utf-8,${RAW_SVG}`;
const URI =
  'otpauth://totp/VUNVAULT:jane@vunvault.com?secret=JBSWY3DPEHPK3PXP&issuer=VUNVAULT&algorithm=SHA1&digits=6&period=30';

describe('TotpQr — rendering', () => {
  it('renders an <img>, never injected markup', () => {
    const { container } = render(<TotpQr svg={SDK_SHAPE} uri={URI} />);
    const img = screen.getByRole('img', { name: 'Authenticator QR code' });
    expect(img.tagName).toBe('IMG');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('produces a parseable payload for BOTH the SDK shape and raw markup', () => {
    const { unmount } = render(<TotpQr svg={SDK_SHAPE} />);
    const fromSdk = (screen.getByTestId('totp-qr') as HTMLImageElement).src;
    unmount();

    render(<TotpQr svg={RAW_SVG} />);
    const fromRaw = (screen.getByTestId('totp-qr') as HTMLImageElement).src;

    expect(fromSdk).toBe(fromRaw);
    expect(fromSdk).toBe(qrCodeSrc(SDK_SHAPE));
    const payload = decodeURIComponent(fromSdk.slice(fromSdk.indexOf(',') + 1));
    expect(payload.startsWith('<svg')).toBe(true);
  });

  it('accepts a custom alt, class and intrinsic size', () => {
    render(
      <TotpQr svg={SDK_SHAPE} alt="Scan me" className="rounded-xl" width={192} height={192} />,
    );
    const img = screen.getByRole('img', { name: 'Scan me' });
    expect(img).toHaveAttribute('class', 'rounded-xl');
    expect(img).toHaveAttribute('width', '192');
    expect(img).toHaveAttribute('height', '192');
  });
});

describe('TotpQr — the fallback is never silent', () => {
  it('replaces the image with an alert when the browser cannot load it', async () => {
    render(<TotpQr svg={SDK_SHAPE} uri={URI} />);
    const img = screen.getByTestId('totp-qr');

    fireEvent.error(img);

    expect(screen.queryByTestId('totp-qr')).toBeNull();
    expect(screen.getByTestId('totp-qr-fallback')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/did not render in this browser/);
  });

  it('hands over the otpauth:// URI so the member can enrol by hand', async () => {
    render(<TotpQr svg={SDK_SHAPE} uri={URI} />);
    fireEvent.error(screen.getByTestId('totp-qr'));
    expect(screen.getByTestId('totp-qr-uri')).toHaveTextContent(URI);
  });

  it('shows the manual-key copy when the API sent no URI', () => {
    render(<TotpQr svg="" uri={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load your QR code/);
    expect(screen.getByRole('alert')).toHaveTextContent(/Use the setup key below/);
    expect(screen.queryByTestId('totp-qr-uri')).toBeNull();
  });

  it('never renders an <img> with an empty src', () => {
    render(<TotpQr svg="   " />);
    expect(screen.queryByTestId('totp-qr')).toBeNull();
  });

  it('does not echo a non-otpauth URI back into the DOM', () => {
    render(<TotpQr svg="" uri="javascript:alert(1)" />);
    expect(screen.queryByTestId('totp-qr-uri')).toBeNull();
  });

  it('retries the image when a fresh challenge arrives', () => {
    const { rerender } = render(<TotpQr svg={SDK_SHAPE} uri={URI} />);
    fireEvent.error(screen.getByTestId('totp-qr'));
    expect(screen.getByTestId('totp-qr-fallback')).toBeInTheDocument();

    rerender(<TotpQr svg={`${SDK_SHAPE}<!--new-->`} uri={URI} />);
    expect(screen.getByTestId('totp-qr')).toBeInTheDocument();
    expect(screen.queryByTestId('totp-qr-fallback')).toBeNull();
  });
});
