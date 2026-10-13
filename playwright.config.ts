import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration (Task 107).
 *
 * The E2E suite runs against `next dev` with the app's OWN MSW mock layer
 * (`NEXT_PUBLIC_API_MOCKING=enabled`): the browser talks to the real web app,
 * and every API response comes from the contract fixtures through the same
 * handlers the unit tests use. No database, no API process, no providers —
 * and no fixture data that the contracts do not already pin.
 *
 * CI-gated: the `e2e` job in ci.yml installs Chromium and runs this; locally
 * `pnpm exec playwright test` works the same way.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // The MSW worker script is copied, not `msw init`ed (no package.json
    // mutation, no prompt). Then the dev server on a dedicated port.
    command:
      "node -e \"require('fs').copyFileSync('apps/web/node_modules/msw/mockServiceWorker.js','apps/web/public/mockServiceWorker.js')\" && pnpm --filter web exec next dev --turbopack -p 3100",
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
      NEXT_PUBLIC_API_MOCKING: 'enabled',
    },
  },
});
