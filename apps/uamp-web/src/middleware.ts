import { type NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { buildCsp } from './lib/csp';

const OPEN_PATHS = new Set(['/login', '/forbidden']);

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function middleware(request: NextRequest): NextResponse {
  const requestNonce = nonce();
  const csp = buildCsp({
    nonce: requestNonce,
    apiOrigin: env.NEXT_PUBLIC_API_URL,
    r2Origin: env.NEXT_PUBLIC_R2_HOST || 'assets.vunvault.com',
    dev: process.env.NODE_ENV === 'development'
  });

  const withCsp = (response: NextResponse) => {
    response.headers.set('content-security-policy', csp);
    return response;
  };

  const pathname = request.nextUrl.pathname;
  const hasSessionCookie =
    request.cookies.get('vv_at') !== undefined ||
    request.cookies.get('vv_rt') !== undefined;

  if (!OPEN_PATHS.has(pathname) && !hasSessionCookie) {
    const target = new URL('/login', request.url);
    target.searchParams.set('next', pathname + request.nextUrl.search);
    return withCsp(NextResponse.redirect(target, 302));
  }

  const headers = new Headers(request.headers);
  headers.set('x-nonce', requestNonce);
  return withCsp(NextResponse.next({ request: { headers } }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)']
};
