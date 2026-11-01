import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, clearToken, getToken, setToken, signIn } from './api';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/vnd.api+json' },
  });

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('unwraps {data} and attaches the bearer token', async () => {
    setToken('tok123');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: { type: 'ping', id: 'platform', attributes: { ok: true } } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiFetch<{ attributes: { ok: boolean } }>('/platform/ping');

    expect(data.attributes.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok123');
  });

  it('sends JSON:API bodies as {data:{type,attributes}}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/platform/tenants/abc/suspend', {
      method: 'POST',
      type: 'tenant_transition',
      attributes: { reason: 'fraud', purpose: 'ticket 1' },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/platform/tenants/abc/suspend');
    expect(JSON.parse(init.body as string)).toEqual({
      data: { type: 'tenant_transition', attributes: { reason: 'fraud', purpose: 'ticket 1' } },
    });
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/vnd.api+json',
    );
  });

  it('throws ApiError with the first error detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          errors: [{ status: '409', code: 'CONFLICT', detail: 'cannot approve a suspended tenant' }],
        }),
      ),
    );

    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe('cannot approve a suspended tenant');
    expect((err as ApiError).code).toBe('CONFLICT');
  });

  it('clears the token on 401', async () => {
    setToken('expired');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { errors: [] })));

    await expect(apiFetch('/platform/tenants')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });
});

describe('signIn', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts platform-scope credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          type: 'session',
          id: 'u1',
          attributes: { token: 'jwt', token_type: 'Bearer', expires_in: 3600, user: {} },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await signIn('admin@demo.test', 'pw');
    expect(session.attributes.token).toBe('jwt');
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.data.attributes).toEqual({
      scope: 'platform',
      identifier: 'admin@demo.test',
      password: 'pw',
    });
  });
});
