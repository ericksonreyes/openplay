import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the OpenPlay stack (ADR-0008).
 *
 * Every app base URL is overridable via env so the same suites run against
 * local docker-compose, an isolated E2E world, or a remote environment:
 *
 *   E2E_BASE_URL_API     backend      (default http://localhost:8000)
 *   E2E_BASE_URL_3000    public-site  (default http://localhost:3000)
 *   E2E_BASE_URL_3001    player       (default http://localhost:3001)
 *   E2E_BASE_URL_3002    venue        (default http://localhost:3002)
 *   E2E_BASE_URL_3003    platform     (default http://localhost:3003)
 *
 * Specs read URLs through tests/e2e/lib/env.ts — never hard-code hosts.
 */

export const urls = {
  api: process.env.E2E_BASE_URL_API ?? 'http://localhost:8000',
  publicSite: process.env.E2E_BASE_URL_3000 ?? 'http://localhost:3000',
  player: process.env.E2E_BASE_URL_3001 ?? 'http://localhost:3001',
  venue: process.env.E2E_BASE_URL_3002 ?? 'http://localhost:3002',
  platform: process.env.E2E_BASE_URL_3003 ?? 'http://localhost:3003',
} as const;

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  /* Persona smoke flows must be deterministic — no retries locally. */
  retries: 0,
  workers: undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: urls.publicSite,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
