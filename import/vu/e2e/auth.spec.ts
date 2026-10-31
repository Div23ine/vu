import { expect, test } from '@playwright/test';
import { CLIENT_EMAIL, PASSWORD, failOnPageErrors, loginClient } from './helpers';

/**
 * Auth smoke : the client login flow against the MSW mock layer —
 * success lands in the portal, bad credentials stay on the form with an error.
 */

test('a client signs in and lands behind the portal guard', async ({ page }) => {
  failOnPageErrors(page);
  await loginClient(page);
  // The portal chrome is up: some authenticated navigation exists.
  await expect(page.locator('nav, aside').first()).toBeVisible();
});

test('wrong credentials are refused without leaving the form', async ({ page }) => {
  failOnPageErrors(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('nobody@example.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page
    .getByRole('button', { name: /sign in|log in|continue/i })
    .first()
    .click();

  // Still on /login, and the page shows a refusal (the exact string belongs to
  // the unit suite; here it is enough that an alert-role or error text exists).
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('[role="alert"], [aria-live]').first()).toBeVisible({
    timeout: 15_000,
  });
  // The fixture client is NOT signed in: no portal chrome.
  expect(page.url()).not.toMatch(/\/portal/);
  void CLIENT_EMAIL;
});
