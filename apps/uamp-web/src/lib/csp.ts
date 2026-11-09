export interface CspOptions { nonce: string; apiOrigin: string; dev: boolean; }

export function buildCsp({nonce,apiOrigin,dev}:CspOptions):string {
 const scriptSrc=["script-src 'self'",`'nonce-${nonce}'`,"'strict-dynamic'",...(dev?["'unsafe-eval'"]:[])].join(' ');
 return [
  "default-src 'self'",scriptSrc,"style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:","font-src 'self'",
  `connect-src 'self' ${apiOrigin}`,
  "frame-src 'self'","object-src 'none'","base-uri 'self'",
  "form-action 'self'","frame-ancestors 'none'","upgrade-insecure-requests"
 ].join('; ');
}