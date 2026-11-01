import { test, expect, type Page } from '@playwright/test';
import { BASE_URLS, accounts } from '../lib/env';

/**
 * Platform administrator persona smoke — platform-scoped sign-in
 * (email + password, no tenant code) at the platform portal, then the
 * tenants list which must show both seeded tenants (acme + bayside).
 */

test.use({ baseURL: BASE_URLS.platform });

async function signInAsPlatformAdmin(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel(/email or username/i).fill(accounts.platformAdmin.identifier);
  await page.getByLabel(/password/i).fill(accounts.platformAdmin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
}

test.describe('Platform admin', () => {
  test('platform sign-in renders the dashboard', async ({ page }) => {
    await signInAsPlatformAdmin(page);
    /* The SPA redirects authenticated users off /sign-in to "/". */
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  test('tenants list shows acme and bayside', async ({ page }) => {
    await signInAsPlatformAdmin(page);
    await page.goto('/tenants');
    await expect(
      page.getByRole('heading', { name: /tenants/i }),
    ).toBeVisible();
    await expect(page.getByText(/acme/i).first()).toBeVisible();
    await expect(page.getByText(/bayside/i).first()).toBeVisible();
  });
});
