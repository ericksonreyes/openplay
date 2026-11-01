import { test, expect, request } from '@playwright/test';
import { BASE_URLS, accounts } from '../lib/env';

/**
 * API smoke — no browser. Verifies the backend is alive, the JSON:API
 * envelope shape holds, and the auth round-trip (sign-in → me → sign-out
 * → revoked) works end to end.
 */

const API = BASE_URLS.api;

test.describe('API smoke', () => {
  test('GET /health returns ok', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.status ?? body.data.attributes?.status).toBe('ok');
    await ctx.dispose();
  });

  test('GET /health/ready returns ok', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/health/ready');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeDefined();
    await ctx.dispose();
  });

  test('GET /api/v1/public/status returns a status resource', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/api/v1/public/status');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.type).toBe('status');
    expect(body.data.attributes.status).toBe('ok');
    await ctx.dispose();
  });

  test('GET /api/v1/me unauthenticated → 401 with JSON:API errors[]', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const res = await ctx.get('/api/v1/me');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(Array.isArray(body.errors)).toBeTruthy();
    expect(body.errors.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('sign-in → me → sign-out → token revoked', async () => {
    const ctx = await request.newContext({ baseURL: API });

    const signIn = await ctx.post('/api/v1/auth/sign-in', {
      data: {
        scope: accounts.platformAdmin.scope,
        identifier: accounts.platformAdmin.identifier,
        password: accounts.platformAdmin.password,
      },
    });
    expect(signIn.ok()).toBeTruthy();
    const session = await signIn.json();
    const token: string = session.attributes?.token;
    expect(token).toBeTruthy();
    expect(session.attributes.user.scope).toBe('platform');

    const authed = await request.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const me = await authed.get('/api/v1/me');
    expect(me.ok()).toBeTruthy();
    const actor = await me.json();
    expect(actor.type).toBe('actor');
    expect(actor.attributes.is_platform).toBe(true);

    const signOut = await authed.post('/api/v1/auth/sign-out');
    expect(signOut.ok()).toBeTruthy();
    expect((await signOut.json()).attributes.revoked).toBe(true);

    /* Same token must now be rejected — the jti blacklist revoked it. */
    const after = await authed.get('/api/v1/me');
    expect(after.status()).toBe(401);
    const denied = await after.json();
    expect(Array.isArray(denied.errors)).toBeTruthy();

    await authed.dispose();
    await ctx.dispose();
  });
});
