import { type NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { buildCsp } from './lib/csp';
import { peekClaims } from './lib/jwt-peek';
import { homeFor } from './lib/permissions';

/**
 * Edge middleware (Task 43) — runs on Cloudflare for every non-static request.
 *
 * Two jobs, deliberately shallow:
 *
 *  1. **CSP nonce.** Mint a per-request nonce (Web Crypto only — this file
 *     must stay edge-compatible), expose it to the render as the `x-nonce`
 *     request header, and set the `Content-Security-Policy` response header
 *     from `buildCsp`. Every response leaves with a CSP, redirects included.
 *     The static security headers (HSTS, X-Frame-Options, …) are already set
 *     in `next.config.ts` (Task 41) and are NOT duplicated here.
 *
 *  2. **Route guards — cookie presence only.** The middleware checks that a
 *     session cookie EXISTS before letting a guarded path render, and steers
 *     logged-in visitors away from `/login`/`/signup`. It never validates a
 *     token: peeking the role is a routing convenience, never a security
 *     decision — the API remains the authority on every data call, and
 *     `requireSession` re-checks server-side before guarded layouts render.
 */

/** Access-token cookie (HttpOnly). */
const ACCESS_TOKEN_COOKIE = 'vv_at';
/** Refresh-token cookie (HttpOnly). Presence counts as "has a session". */
const REFRESH_TOKEN_COOKIE = 'vv_rt';

/**
 * Fallback CDN host — the same default `next.config.ts` (Task 41) uses for
 * `images.remotePatterns`, so CSP `img-src` and the image optimiser agree.
 */
const DEFAULT_R2_HOST = 'assets.vunvault.com';

const GUARDED_PREFIXES = ['/portal', '/admin'] as const;

function requiresSession(pathname: string): boolean {
  if (pathname === '/onboarding') return true;
  return GUARDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup';
}

function isAdminArea(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** 16 random bytes, base64 — Web Crypto only (no `node:crypto`, no `Buffer`). */
function mintNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function middleware(request: NextRequest): NextResponse {
  const nonce = mintNonce();
  const csp = buildCsp({
    nonce,
    apiOrigin: env.NEXT_PUBLIC_API_URL,
    r2Origin: env.NEXT_PUBLIC_R2_HOST ?? DEFAULT_R2_HOST,
    dev: process.env.NODE_ENV === 'development',
  });

  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set('content-security-policy', csp);
    return response;
  };
  const redirectTo = (pathAndSearch: string): NextResponse =>
    withCsp(NextResponse.redirect(new URL(pathAndSearch, request.url), 302));

  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const hasSessionCookie =
    accessToken !== undefined || request.cookies.get(REFRESH_TOKEN_COOKIE)?.value !== undefined;
  // Routing convenience only — never a security decision (see module docs).
  const peekedRole = accessToken === undefined ? undefined : peekClaims(accessToken)?.role;

  // 1. Guarded areas need a session cookie; without one, go log in and come back.
  if (requiresSession(pathname) && !hasSessionCookie) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  // 2. Auth pages are pointless with a session — land the visitor where they belong.
  //    If `vv_at` is missing or unreadable, do nothing: the page itself handles it.
  if (isAuthPage(pathname) && hasSessionCookie && peekedRole !== undefined) {
    return redirectTo(homeFor(peekedRole));
  }

  // 3. A client-role token has no business in the admin area.
  if (isAdminArea(pathname) && peekedRole === 'client') {
    return redirectTo('/forbidden');
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
}

/**
 * Every path except build output and static assets: `_next/static`,
 * `_next/image`, `favicon.ico`, the operator's `brand/*` files and the MSW
 * worker script (a service worker must be served byte-identical, CSP header
 * or not — and it is static, not a route).
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|mockServiceWorker.js).*)'],
};
