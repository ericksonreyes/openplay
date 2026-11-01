import { test, expect } from '@playwright/test';
import { BASE_URLS } from '../lib/env';

/**
 * Public discovery (anonymous persona) — the Next.js public site renders
 * server-side, so plain text/role selectors against seeded demo data:
 * "Acme Sports Club" business, its venue, and the pickleball open-play event.
 */

test.use({ baseURL: BASE_URLS.publicSite });

test.describe('Public discovery', () => {
  test('businesses directory lists Acme Sports Club', async ({ page }) => {
    await page.goto('/businesses');
    await expect(page.getByRole('heading', { name: 'Businesses' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Acme Sports Club/ })).toBeVisible();
  });

  test('business profile page loads', async ({ page }) => {
    await page.goto('/businesses/acme');
    await expect(
      page.getByRole('heading', { name: /Acme Sports Club/ }),
    ).toBeVisible();
  });

  test('venue page shows an availability section', async ({ page }) => {
    await page.goto('/businesses/acme');
    /* Drill from the business profile into one of its venues. */
    const venueLink = page.getByRole('link', { name: /Acme Main Hall/ }).first();
    await expect(venueLink).toBeVisible();
    await venueLink.click();
    await expect(page).toHaveURL(/\/venues\//);
    await expect(
      page.getByRole('heading', { name: /availability/i })
        .or(page.getByText(/availability/i).first()),
    ).toBeVisible();
  });

  test('events list shows the pickleball open-play event', async ({ page }) => {
    await page.goto('/events');
    await expect(
      page.getByRole('heading', { name: /Upcoming events/i }),
    ).toBeVisible();
    await expect(page.getByText(/Pickleball/i).first()).toBeVisible();
  });
});
