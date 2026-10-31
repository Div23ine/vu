/**
 * JSON-LD renderer.
 *
 * Two things this file exists to get right:
 *
 * 1. **Escaping.** Structured data is interpolated into a `<script>` element, so
 *    every `<` is written as `\u003c`. Without that, a title or answer containing
 *    the literal `</script>` would terminate the element early — a stored-XSS
 *    shape, and here the strings come from a CMS-backed content API. The escape is
 *    applied to the serialised JSON, so it cannot be forgotten per-field.
 *
 * 2. **No nonce, on purpose.** `lib/csp.ts` sets `script-src 'self' 'nonce-…'
 *    'strict-dynamic'` with no `'unsafe-inline'`, and the edge middleware exposes
 *    the nonce as the `x-nonce` request header. A JSON-LD element is a *data
 *    block*: its `type` is not a JavaScript MIME type, so the HTML spec's
 *    "prepare the script element" algorithm returns before the CSP inline check
 *    and the browser never executes it. Noncing it would mean calling `headers()`
 *    in the render, which forces every marketing page to dynamic rendering and
 *    gives up static generation on Cloudflare — a real TTFB and cost regression
 *    to protect a script that does not run. Search engines read the raw HTML, so
 *    the markup is seen either way.
 */

interface JsonLdProps {
  /** A plain object from one of the builders in `lib/seo.ts`. */
  data: Record<string, unknown> | null;
}

/** Serialise for embedding in a `<script>` element: no `<` can survive. */
export function serialiseJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: JsonLdProps) {
  if (data === null) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
