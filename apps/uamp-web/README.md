# UAMP HQ frontend

Standalone Next.js application for the UAMP HQ product.

- Source: `apps/uamp-web`
- Next.js build: `apps/uamp-web/.next`
- OpenNext Worker build: `apps/uamp-web/.open-next`
- Worker config: `apps/uamp-web/wrangler.jsonc`
- Product origin: `https://uamp.vunvault.com`
- Shared API namespace: `/api/v1/uamp/`

This app is not a route group or build target inside `apps/web`. It shares platform packages and the VUNVAULT API only.

## Commands

```sh
pnpm --filter uamp-web dev
pnpm --filter uamp-web typecheck
pnpm --filter uamp-web lint
pnpm --filter uamp-web cf:build
pnpm --filter uamp-web cf:preview
```

## Required deployment configuration

Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_AUTH_URL` at build time. The API's credentialed CORS allow-list must include `https://uamp.vunvault.com`, and `COOKIE_DOMAIN` must be `.vunvault.com` for the same VUNVAULT session to be available on both subdomains.

Production deployment is manual and must be gated by a protected GitHub Environment. DNS and Cloudflare deployment are separate release actions.
