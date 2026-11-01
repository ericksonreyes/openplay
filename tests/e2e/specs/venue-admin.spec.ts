import { test, expect, type Page } from '@playwright/test';
import { BASE_URLS, accounts } from '../lib/env';

/**
 * Venue admin persona smoke — tenant-scoped sign-in (tenant code +
 * username + password) at the venue portal, then dashboard and the
 * catalog venues list which must show the seeded "Acme Main Hall".
 */

test.use({ baseURL: BASE_URLS.venue });

async function signInAsVenueOwner(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/tenant code/i).fill(accounts.venueOwner.tenantCode);
  await page.getByLabel(/username/i).fill(accounts.venueOwner.identifier);
  await page.getByLabel(/password/i).fill(accounts.venueOwner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

test.describe('Venue admin', () => {
  test('tenant sign-in renders the dashboard', async ({ page }) => {
    await signInAsVenueOwner(page);
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
        .or(page.getByText(/today'?s schedule/i).first()),
    ).toBeVisible();
  });

  test('catalog venues list shows Acme Main Hall', async ({ page }) => {
    await signInAsVenueOwner(page);
    await page.goto('/catalog/venues');
    await expect(page.getByText('Acme Main Hall').first()).toBeVisible();
  });
});
