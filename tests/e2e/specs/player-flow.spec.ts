import { test, expect, type Page } from '@playwright/test';
import { BASE_URLS, accounts } from '../lib/env';

/**
 * Player persona smoke — sign in at the player portal, then verify the
 * authenticated shell renders: home dashboard, reservations, events.
 * Uses the seeded demo player (jane.player@demo.openplay.test).
 */

test.use({ baseURL: BASE_URLS.player });

async function signInAsPlayer(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(accounts.player.identifier);
  await page.getByLabel(/password/i).fill(accounts.player.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  /* SPA navigation: sign-in navigates to "/" once the session lands. */
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

test.describe('Player flow', () => {
  test('sign-in renders the dashboard', async ({ page }) => {
    await signInAsPlayer(page);
    await expect(
      page.getByRole('heading', { name: /upcoming reservations/i })
        .or(page.getByText(/upcoming reservations/i).first()),
    ).toBeVisible();
  });

  test('reservations list loads', async ({ page }) => {
    await signInAsPlayer(page);
    await page.goto('/reservations');
    await expect(
      page.getByRole('heading', { name: /my reservations/i })
        .or(page.getByText(/my reservations/i).first()),
    ).toBeVisible();
  });

  test('events page loads', async ({ page }) => {
    await signInAsPlayer(page);
    await page.goto('/events');
    await expect(
      page.getByRole('heading', { name: 'Events', exact: true })
        .or(page.getByText('Events').first()),
    ).toBeVisible();
  });
});
