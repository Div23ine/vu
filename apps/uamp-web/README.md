# UAMP HQ frontend

This is the standalone UAMP HQ frontend workspace. Its Next.js project, .next
build directory, OpenNext .open-next output, Wrangler Worker and release
workflow are separate from apps/web.

## Local development

Copy apps/uamp-web/.env.example to apps/uamp-web/.env.local and run:

    pnpm --filter uamp-web dev

The frontend listens on port 3010. Set NEXT_PUBLIC_API_URL to the VUNVAULT
Fastify API, NEXT_PUBLIC_SITE_URL to the local UAMP URL, and
NEXT_PUBLIC_AUTH_URL to the VUNVAULT web sign-in origin.

## Build and deploy independently

    pnpm --filter uamp-web cf:build
    pnpm --filter uamp-web cf:preview
    pnpm --filter uamp-web cf:deploy:staging
    pnpm --filter uamp-web cf:deploy:production

apps/uamp-web/wrangler.jsonc owns the UAMP Worker. Production attaches the
uamp.vunvault.com custom domain to uamp-hq-production; staging uses its
separate Worker name and workers.dev address.

The standalone GitHub Actions workflow is .github/workflows/deploy-uamp-web.yml.
It deploys after changes to this app or its shared frontend dependencies, and
also supports a manually selected GitHub Environment. Production deployment
must pass the repository production-environment approval gates.

## Shared platform requirements

UAMP uses the existing VUNVAULT API, contracts, session authority and database.
It does not create a separate API, login system, user database or billing
service. The API must allow https://uamp.vunvault.com in its WEB_ORIGIN
allow-list and set COOKIE_DOMAIN=.vunvault.com in production so the existing
HttpOnly session cookie is available to both web applications.

The initial sign-in link opens the existing VUNVAULT login app in a new tab.
After authentication, return to the UAMP tab and refresh it. The API currently
uses its configured primary WEB_ORIGIN for the magic-link/MFA browser callback,
so a fully seamless cross-app login handoff needs a separately reviewed auth
callback enhancement. Do not weaken the redirect allow-list to solve that issue.

NEXT_PUBLIC_* values are public build-time configuration only. Never put
credentials or secrets in this app .env files, Wrangler config or browser
bundle.
