export interface CspOptions {
  nonce: string;
  apiOrigin: string;
  r2Origin: string;
  dev: boolean;
}

export function buildCsp({ nonce, apiOrigin, r2Origin, dev }: CspOptions): string {
  const apiHost = new URL(apiOrigin).host;
  const directives = [
    "default-src 'self'",
    ["script-src 'self'", "'nonce-" + nonce + "'", "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://" + r2Origin,
    "font-src 'self'",
    "connect-src 'self' " + apiOrigin + " wss://" + apiHost + " https://*.ingest.sentry.io",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];
  return directives.join('; ');
}
