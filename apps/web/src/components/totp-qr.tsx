'use client';

import { useEffect, useMemo, useState } from 'react';
import { otpauthUri, qrCodeSrc } from '../lib/qr';

/**
 * The TOTP enrolment QR code, and the manual-entry fallback behind it.
 *
 * Shared by all four enrolment surfaces (the signup verify dialog, `/signup/enroll`,
 * `/login/mfa/setup` and Portal → Security) because they all render the same
 * thing and, until this component existed, each carried its own copy of the
 * data-URI wrapper. That duplication is what let the blank-QR bug survive: the
 * wrapper was wrong in two places at once and every fixture fed both of them
 * raw SVG, so no test ever saw the shape the real SDK returns.
 *
 * Two rules this component enforces that the four call sites previously left to
 * chance:
 *
 * 1. **A render failure is never silent.** A broken `<img>` throws nothing —
 *    it just paints an empty box, which is exactly what was reported ("blank
 *    space or error state"). `onError` swaps in a visible, `role="alert"`
 *    notice plus the `otpauth://` URI, so the member can still enrol by hand.
 *    Work order §H2: a manual-entry fallback is acceptable, a silent failure
 *    is not.
 * 2. **The SVG is never injected as markup.** `dangerouslySetInnerHTML` is
 *    banned repo-wide; the string only ever travels inside a data URI.
 */

export interface TotpQrProps {
  /**
   * The `qrCodeSvg` field from the API. `qrCodeSrc` accepts raw SVG markup,
   * an already-formed data URI (what `@supabase/auth-js` returns) or a base64
   * data URI, and normalises all three — so this prop is safe whatever the
   * backend hands over.
   */
  svg: string;
  /** The `otpauth://` provisioning URI, shown for manual entry. */
  uri?: string | null;
  alt?: string;
  /** Extra classes on the `<img>`; sizing normally comes from the wrapper CSS. */
  className?: string;
  /** Preserved so existing DOM hooks (`#vvSetupQr`) keep working. */
  id?: string;
  width?: number;
  height?: number;
}

const DEFAULT_ALT = 'Authenticator QR code';

export function TotpQr({ svg, uri, alt = DEFAULT_ALT, className, id, width, height }: TotpQrProps) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => qrCodeSrc(svg), [svg]);
  const manualUri = otpauthUri(uri);

  // A new challenge (retry, re-enrol) gets a fresh attempt at rendering.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  // Nothing usable came back from the API: say so instead of painting an empty
  // box. The secret + URI below are the way forward.
  //
  // Tailwind utilities rather than the `.vv-*` tokens: those live in the
  // `(auth)` stylesheets and this component is also rendered inside `(authed)`
  // (Portal → Security), where they are not loaded.
  if (src === '' || failed) {
    return (
      <div
        className="w-full space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left"
        data-testid="totp-qr-fallback"
      >
        <p role="alert" className="text-xs font-bold text-amber-900">
          {src === ''
            ? 'We could not load your QR code.'
            : 'Your QR code did not render in this browser.'}
          {manualUri === '' ? ' Use the setup key below to add VUNVAULT manually.' : ''}
        </p>
        {manualUri !== '' && (
          <div className="space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Or paste this setup URI into your app
            </span>
            <code
              className="block break-all rounded-lg bg-white/70 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-neutral-900"
              data-testid="totp-qr-uri"
            >
              {manualUri}
            </code>
          </div>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-URI SVG, not an optimisable asset
    <img
      src={src}
      alt={alt}
      id={id}
      width={width}
      height={height}
      className={className}
      data-testid="totp-qr"
      onError={() => setFailed(true)}
    />
  );
}
