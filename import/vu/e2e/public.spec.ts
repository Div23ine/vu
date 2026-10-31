import { expect, test } from '@playwright/test';
import { failOnPageErrors } from './helpers';

/**
 * Public surface smoke : the marketing site renders, navigates and
 * throws nothing. Copy assertions stay minimal on purpose — the unit suites
 * pin the verbatim strings; E2E proves the whole page (RSC + hydration +
 * stylesheets + middleware) actually comes up in a browser.
 */

test('the home page renders the brand without page errors', async ({ page }) => {
  failOnPageErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toContainText('VUNVAULT');
  // No preloader gates the first paint: the hero content is in the DOM.
  await expect(page.locator('main, [data-testid="hero"], section').first()).toBeVisible();
});

test('primary navigation reaches its pages', async ({ page }) => {
  failOnPageErrors(page);
  await page.goto('/');
  for (const path of ['/about', '/services', '/pricing']) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBe(true);
    await expect(page.locator('body')).toContainText('VUNVAULT');
  }
});

test('the login page is reachable and offers the form', async ({ page }) => {
  failOnPageErrors(page);
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
