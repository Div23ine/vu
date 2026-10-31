import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E flows . The identities are the contract fixtures —
 * the mock layer authenticates exactly these two and nobody else.
 */

export const CLIENT_EMAIL = 'jane.wanjiru@acmefintech.co.ke';
export const STAFF_EMAIL = 'e.reed@vunvault.com';
/** The mock accepts any well-formed credentials for the fixture identities. */
export const PASSWORD = 'Str0ng!Passw0rd';

export async function loginClient(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(CLIENT_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page
    .getByRole('button', { name: /sign in|log in|continue/i })
    .first()
    .click();
  await page.waitForURL(/\/(portal|dashboard|onboarding)/, { timeout: 30_000 });
}

export async function loginStaff(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(STAFF_EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page
    .getByRole('button', { name: /sign in|log in|continue/i })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  // The mock offers webauthn, totp and email_otp; the dialog defaults to the
  // platform authenticator, which a headless browser cannot answer. Switch to
  // the code path (labelled `Code` in the dialog's own switcher) instead of
  // weakening the mock: the production list is a fact the UI must handle.
  const totpSwitch = dialog.getByRole('button', { name: /use authenticator app/i });
  if (await totpSwitch.isVisible().catch(() => false)) {
    await totpSwitch.click();
  }

  const digits = dialog.locator('#vvOtpInputs input');
  await expect(digits.first()).toBeVisible({ timeout: 15_000 });
  await digits.first().click();
  for (const digit of '123456') {
    await page.keyboard.type(digit);
  }
  await dialog.getByRole('button', { name: /verify otp/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
}

/** Fail the test on any uncaught page error — the smoke bar. */
export function failOnPageErrors(page: Page): void {
  page.on('pageerror', (error) => {
    throw new Error(`Uncaught page error: ${error.message}`);
  });
}
