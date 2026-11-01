/**
 * Shared environment for the E2E suites.
 * URLs come from playwright.config.ts; demo credentials come from
 * workspace/specs/testing/TEST_ACCOUNTS.MD (local dev only).
 */
import { urls } from '../playwright.config';

export const BASE_URLS = urls;

export const DEMO_PASSWORD = 'demo-pass-123';

export const accounts = {
  platformAdmin: {
    scope: 'platform' as const,
    identifier: 'platform.admin@demo.openplay.test',
    password: DEMO_PASSWORD,
  },
  venueOwner: {
    scope: 'tenant' as const,
    tenantCode: 'acme',
    identifier: 'acme.owner',
    password: DEMO_PASSWORD,
  },
  player: {
    scope: 'platform' as const,
    identifier: 'jane.player@demo.openplay.test',
    password: DEMO_PASSWORD,
  },
} as const;
