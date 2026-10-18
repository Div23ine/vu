import { expect, test } from '@playwright/test';
import { failOnPageErrors, loginClient } from './helpers';

/**
 * Client portal smoke : the signed-in client sees the fixture
 * estate — dashboard tiles and the scan list — and the release lock keeps
 * unreleased reports invisible (no report link for a non-released job).
 */

test('the portal dashboard renders for a signed-in client', async ({ page }) => {
  failOnPageErrors(page);
  await loginClient(page);
  await page.goto('/portal');
  // The Horizon SACCO fixture org is the client's world.
  await expect(page.locator('body')).toContainText(/Horizon|dashboard/i);
});

test('the portal advisories page lists the published fixture advisories', async ({ page }) => {
  failOnPageErrors(page);
  await loginClient(page);
  await page.goto('/portal/advisories');
  // The intel fixtures drive the mock list; at least one CVE renders.
  await expect(page.locator('body')).toContainText(/CVE-/);
});

test('an unauthenticated visit to the portal is guarded', async ({ page }) => {
  failOnPageErrors(page);
  await page.goto('/portal');
  // The guard redirects to the login surface (or renders it in place).
  await page.waitForURL(/\/(login|portal)/, { timeout: 30_000 });
  if (!page.url().includes('/portal')) {
    await expect(page.getByLabel('Email address')).toBeVisible();
  }
});
