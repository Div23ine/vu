import { describe, expect, it } from 'vitest';
import { isQrDataUri, otpauthUri, qrCodeSrc } from './qr';

/**
 * Regression suite for the signup TOTP QR bug (work order Task 3).
 *
 * The failure this pins: `@supabase/auth-js@2.117.3` wraps GoTrue's raw SVG
 * into a data URI inside `GoTrueClient._enroll` (line 5830 of the SDK):
 *
 *     data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`
 *
 * `apps/api` passes that straight through as `qrCodeSvg`, and the web used to
 * wrap it a SECOND time. The browser then decoded the payload to the literal
 * text `data:image/svg+xml;utf-8,<svg …`, tried to parse that as XML, failed,
 * and showed a blank box. Every fixture in the repo (MSW handlers, API unit
 * tests) used raw SVG, so nothing caught it.
 */

/** What GoTrue's `/factors` endpoint returns, before the SDK touches it. */
const RAW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="99" height="99">' +
  '<rect x="0" y="0" width="99" height="99" fill="#ffffff"/>' +
  '<rect x="3" y="3" width="3" height="3" fill="#000000"/>' +
  '</svg>';

/** What `@supabase/auth-js` `_enroll` hands the API — the real production shape. */
const SDK_OUTPUT = `data:image/svg+xml;utf-8,${RAW_SVG}`;

/** Undo `qrCodeSrc`'s own encoding, the way a browser reading `<img src>` does. */
function decodedPayload(src: string): string {
  const comma = src.indexOf(',');
  expect(comma).toBeGreaterThan(0);
  return decodeURIComponent(src.slice(comma + 1));
}

describe('qrCodeSrc — the SDK data-URI shape (the reported bug)', () => {
  it('does NOT double-wrap an already-formed data URI', () => {
    const src = qrCodeSrc(SDK_OUTPUT);
    expect(src).not.toContain('data%3Aimage');
    expect(src).not.toContain('data:image/svg+xml;charset=utf-8,data:');
  });

  it('produces a payload the browser can parse as SVG', () => {
    expect(decodedPayload(qrCodeSrc(SDK_OUTPUT)).trimStart().startsWith('<svg')).toBe(true);
  });

  it('is idempotent — wrapping the output again changes nothing', () => {
    const once = qrCodeSrc(SDK_OUTPUT);
    expect(qrCodeSrc(once)).toBe(once);
    expect(qrCodeSrc(qrCodeSrc(once))).toBe(once);
  });

  it('percent-encodes a "#" so it cannot truncate the payload as a fragment', () => {
    // The SDK's wrapper leaves `fill="#ffffff"` raw; a `#` in a URL starts the
    // fragment and the browser drops everything after it.
    expect(qrCodeSrc(SDK_OUTPUT)).not.toMatch(/,(?![^,]*$)[^]*#/);
    const src = qrCodeSrc(SDK_OUTPUT);
    expect(src.slice(src.indexOf(',') + 1)).not.toContain('#');
    expect(decodedPayload(src)).toContain('fill="#ffffff"');
  });
});

describe('qrCodeSrc — raw SVG (the fixture shape)', () => {
  it('wraps raw markup into a utf-8 data URI', () => {
    const src = qrCodeSrc(RAW_SVG);
    expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodedPayload(src)).toBe(RAW_SVG);
  });

  it('produces the SAME src for both shapes — the two are equivalent input', () => {
    expect(qrCodeSrc(RAW_SVG)).toBe(qrCodeSrc(SDK_OUTPUT));
  });

  it('is idempotent on raw markup too', () => {
    expect(qrCodeSrc(qrCodeSrc(RAW_SVG))).toBe(qrCodeSrc(RAW_SVG));
  });

  it('undoes one layer of percent-encoding when a producer pre-encoded it', () => {
    const preEncoded = `data:image/svg+xml;utf8,${encodeURIComponent(RAW_SVG)}`;
    expect(decodedPayload(qrCodeSrc(preEncoded))).toBe(RAW_SVG);
  });
});

describe('qrCodeSrc — other producer shapes', () => {
  it('passes a base64 SVG data URI through untouched (re-encoding would corrupt it)', () => {
    const base64 = `data:image/svg+xml;base64,${Buffer.from(RAW_SVG).toString('base64')}`;
    expect(qrCodeSrc(base64)).toBe(base64);
  });

  it('passes a non-SVG data URI (PNG) through untouched', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    expect(qrCodeSrc(png)).toBe(png);
  });

  it('returns "" for empty input so callers can render an explicit fallback', () => {
    expect(qrCodeSrc('')).toBe('');
    expect(qrCodeSrc('   ')).toBe('');
  });

  it('survives a payload that is neither markup nor valid percent-encoding', () => {
    // `%zz` throws inside decodeURIComponent; the helper must not.
    expect(() => qrCodeSrc('data:image/svg+xml;charset=utf-8,100%zz')).not.toThrow();
  });

  it('trims surrounding whitespace before deciding the shape', () => {
    expect(qrCodeSrc(`  ${RAW_SVG}\n`)).toBe(qrCodeSrc(RAW_SVG));
  });
});

describe('isQrDataUri', () => {
  it('recognises a data URI and rejects raw markup', () => {
    expect(isQrDataUri(SDK_OUTPUT)).toBe(true);
    expect(isQrDataUri('data:image/png;base64,AAA')).toBe(true);
    expect(isQrDataUri(RAW_SVG)).toBe(false);
    expect(isQrDataUri('')).toBe(false);
  });
});

describe('otpauthUri — the manual-entry fallback', () => {
  const URI =
    'otpauth://totp/VUNVAULT:jane@vunvault.com?secret=JBSWY3DPEHPK3PXP&issuer=VUNVAULT&algorithm=SHA1&digits=6&period=30';

  it('passes a valid provisioning URI through verbatim', () => {
    expect(otpauthUri(URI)).toBe(URI);
  });

  it('rejects anything that is not an otpauth URI', () => {
    expect(otpauthUri('https://example.com')).toBe('');
    expect(otpauthUri('javascript:alert(1)')).toBe('');
    expect(otpauthUri(null)).toBe('');
    expect(otpauthUri(undefined)).toBe('');
    expect(otpauthUri('   ')).toBe('');
  });

  it('tolerates surrounding whitespace', () => {
    expect(otpauthUri(`  ${URI} `)).toBe(URI);
  });
});
