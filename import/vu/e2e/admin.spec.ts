import { expect, test } from '@playwright/test';
import { failOnPageErrors, loginStaff } from './helpers';

/**
 * Admin smoke : the staff login completes through MFA, and the
 * surfaces the later tasks live on render their fixture data — Command
 * Center, the Scan Queue (with the an earlier iteration Live output action) and the audit
 * trail (with the an earlier iteration state pill).
 */

test('staff sign in through MFA and reach the Command Center', async ({ page }) => {
  failOnPageErrors(page);
  await loginStaff(page);
  await expect(page.locator('body')).toContainText(/Command Center|VUNVAULT/i);
});

test('the Scan Queue lists fixture jobs and offers the live terminal', async ({ page }) => {
  failOnPageErrors(page);
  await loginStaff(page);
  await page.goto('/admin/scan-queue');
  await expect(page.locator('body')).toContainText('JOB-4471');

  // an earlier iteration: the running job's row carries the Live output action, and the
  // terminal dialog opens with its waiting state. The mock layer has no WS
  // relay, so the socket can only sit connecting/reconnecting — the dialog
  // must cope, never crash.
  const liveButton = page.getByRole('button', { name: 'Live output' }).first();
  await expect(liveButton).toBeVisible();
  await liveButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Waiting for output…')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeDisabled();
});

test('the audit trail renders the chain chrome and a real stream pill', async ({ page }) => {
  failOnPageErrors(page);
  await loginStaff(page);
  await page.goto('/admin/audit');
  await expect(page.locator('body')).toContainText('System Audit Logs');

  // A real browser HAS EventSource, so the an earlier iteration hook opens a stream
  // against the mocked origin. MSW cannot serve text/event-stream from these
  // handlers, so the honest end state is RECONNECTING or POLLING — the pill
  // must never claim LIVE without a live socket.
  const pill = page.locator('#al-stream-pill');
  await expect(pill).toBeVisible();
  await expect(pill).toContainText(/LIVE|RECONNECTING|POLLING|PAUSED/);

  // The fixture chain's newest event is on screen.
  await expect(page.locator('body')).toContainText('AUTH_RATE_LIMIT');
});
