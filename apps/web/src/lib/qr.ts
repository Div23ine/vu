/**
 * QR data-URI helper shared by every TOTP enrolment surface.
 *
 * ── Why this file exists, and why it is not a one-liner ──────────────────
 *
 * The obvious implementation is
 *
 *     `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
 *
 * and that was what lived here until the signup TOTP step rendered a blank
 * box. The reason is that **the input is not always raw SVG**. Three shapes
 * reach this function depending on which layer produced it:
 *
 *  1. Raw SVG markup — what GoTrue's `/factors` endpoint actually returns
 *     (`internal/api/mfa.go` writes an `ajstarks/svgo` document into a buffer
 *     and hands back the string; see the `// See: probably-dont-base64-svg`
 *     comment upstream).
 *  2. An **already-formed data URI** — `@supabase/auth-js` wraps shape 1 for
 *     you inside `GoTrueClient._enroll`:
 *
 *         data.totp.qr_code = `data:image/svg+xml;utf-8,${data.totp.qr_code}`
 *
 *     This is the shape the API sees, because `apps/api` calls the SDK rather
 *     than GoTrue's REST endpoint directly.
 *  3. A `;base64,` data URI — what several other QR producers emit.
 *
 * Re-wrapping shape 2 is the bug this module used to have. It produced
 *
 *     data:image/svg+xml;utf8,data%3Aimage%2Fsvg%2Bxml%3Butf-8%2C%3Csvg…
 *
 * The browser percent-decodes the payload and then tries to parse the literal
 * text `data:image/svg+xml;utf-8,<svg …` as XML. That is not markup, the image
 * load fails, and the enrolment panel shows an empty box — with no console
 * error a developer would think to look for, because a broken `<img>` is not
 * an exception. Tests did not catch it either: the MSW fixtures (and the API
 * unit tests) all return shape 1, so the double-wrap never happened under
 * test. `qrCodeSrc` is therefore **idempotent by contract**, and there is a
 * test that pins the SDK's real shape 2 output.
 *
 * A second, subtler trap is handled here too. The SDK's wrapper does NOT
 * percent-encode the SVG, so a `fill="#ffffff"` inside the markup becomes a
 * `#` in the URL — which a browser reads as a fragment identifier and
 * truncates the payload at. Re-emitting the SVG with proper encoding fixes
 * that class of blank-image failure as well.
 *
 * The SVG string is never injected as markup (`dangerouslySetInnerHTML` is
 * banned repo-wide); it only ever travels inside a data URI on an `<img>`.
 */

/** `data:image/svg+xml;charset=utf-8,<percent-encoded markup>`. */
function svgDataUri(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/** An SVG data URI, split so the parameters and the payload can be inspected. */
const SVG_DATA_URI = /^data:image\/svg\+xml(?<params>[^,]*),(?<payload>[\s\S]*)$/i;

/** A `;base64` parameter — its payload must not be percent-decoded or re-encoded. */
const BASE64_PARAM = /;\s*base64\s*$/i;

/** Any data URI at all (`data:<mediatype>[;params],<payload>`). */
const ANY_DATA_URI = /^data:[\w!#$&^+.+-]*\/[\w!#$&^+.+-]+/i;

/**
 * Undo one layer of percent-encoding, but only when it actually reveals
 * markup. The SDK emits its payload raw; other producers emit it encoded; and
 * a payload that is neither (e.g. a base64 blob that slipped past the check
 * above) must be returned untouched rather than mangled by a failed decode.
 */
function decodePayload(payload: string): string {
  if (payload.trimStart().startsWith('<')) return payload;
  try {
    const decoded = decodeURIComponent(payload);
    if (decoded.trimStart().startsWith('<')) return decoded;
  } catch {
    // Not percent-encoded — `%` followed by junk. Use the payload as-is.
  }
  return payload;
}

/** True when the value is already a usable `data:` URI and needs no wrapping. */
export function isQrDataUri(value: string): boolean {
  return ANY_DATA_URI.test(value.trim());
}

/**
 * Normalise any of the three QR shapes above into one `<img src>` value.
 *
 * Idempotent: `qrCodeSrc(qrCodeSrc(x)) === qrCodeSrc(x)` for every `x`.
 * Returns `''` for empty input so callers can render an explicit fallback
 * instead of a silently broken image.
 */
export function qrCodeSrc(qrCodeSvg: string): string {
  const input = qrCodeSvg.trim();
  if (input === '') return '';

  const svgUri = SVG_DATA_URI.exec(input);
  if (svgUri !== null) {
    const params = svgUri.groups?.params ?? '';
    // A base64 payload is already URL-safe; re-encoding it would corrupt it.
    if (BASE64_PARAM.test(params)) return input;
    return svgDataUri(decodePayload(svgUri.groups?.payload ?? ''));
  }

  // A non-SVG data URI (png, jpeg, …) is already usable verbatim.
  if (ANY_DATA_URI.test(input)) return input;

  // Raw SVG markup — the shape the MSW fixtures and the API tests use.
  return svgDataUri(input);
}

/**
 * The provisioning URI the authenticator app scans out of the QR code, handed
 * to the user verbatim for manual entry (work order §H2: "if the QR cannot
 * render, still deliver the URI + Base32 secret").
 *
 * `''` when the API sent nothing usable — callers hide the block rather than
 * showing an empty row.
 */
export function otpauthUri(uri: string | null | undefined): string {
  const value = uri?.trim() ?? '';
  return value.startsWith('otpauth://') ? value : '';
}
