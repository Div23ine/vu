/**
 * Open-redirect guard for `?next=`.
 *
 * Pure and directive-free on purpose: the SERVER route uses it to sanitise
 * `?next=` before any client component sees it, and client hooks import it
 * without pulling a `'use client'` boundary into server code.
 *
 * A usable `next` must start with a single `/` — protocol-relative
 * (`//evil.com`), backslash-trick (`/\evil.com`) and absolute URLs are
 * rejected. Invalid or absent → `null` (fall back to `homeFor(role)`).
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}
