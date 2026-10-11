/**
 * Content-Security-Policy builder (Task 43).
 *
 * The policy is minted per request by the edge middleware around a fresh
 * nonce. Design decisions, in one place:
 *
 *  - `script-src` is nonce + `'strict-dynamic'`: no script executes unless the
 *    server rendered it with this request's nonce (or a nonce'd script loaded
 *    it). Host allowlist covers the three embedded third parties the billing
 *    and signup flows need: Stripe, Paystack and Cloudflare Turnstile.
 *  - `'unsafe-eval'` appears ONLY in development — Next's dev bundler needs
 *    eval for fast refresh. A production policy containing it is a failure.
 *  - `style-src 'unsafe-inline'` stays: Next and Radix inject inline style
 *    attributes; noncing every style tag is a later hardening pass (L14).
 *  - `frame-ancestors 'none'` is the CSP-level clickjacking kill switch (the
 *    legacy `X-Frame-Options: DENY` header is set in `next.config.ts`).
 *  - `connect-src` covers the API origin (plus its WebSocket twin for the
 *    scan terminal), the payment providers' APIs and Sentry ingest.
 *
 * This module is edge-safe: no Node built-ins, no imports at all.
 */

export interface CspOptions {
  /** Per-request base64 nonce, interpolated into `script-src`. */
  nonce: string;
  /** Absolute API origin, e.g. `https://api.vunvault.com`. */
  apiOrigin: string;
  /** CDN host (no scheme) serving uploaded and generated images. */
  r2Origin: string;
  /** Development builds may need `'unsafe-eval'` for fast refresh. */
  dev: boolean;
}

export function buildCsp({ nonce, apiOrigin, r2Origin, dev }: CspOptions): string {
  const apiHost = new URL(apiOrigin).host;

  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https://js.stripe.com',
    'https://js.paystack.co',
    'https://challenges.cloudflare.com',
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${r2Origin}`,
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} wss://${apiHost} https://api.stripe.com https://api.paystack.co https://*.ingest.sentry.io`,
    'frame-src https://js.stripe.com https://checkout.paystack.com https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}
