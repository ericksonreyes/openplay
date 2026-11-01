import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, clearToken, setToken } from './api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/vnd.api+json' },
  });
}

describe('api wrapper', () => {
  it('unwraps the JSON:API data envelope and sends auth headers', async () => {
    setToken('tok123');
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: '1', type: 'venues', attributes: { name: 'A' } }] }));

    const rows = await api.list('/venues');

    expect(rows).toEqual([{ id: '1', type: 'venues', attributes: { name: 'A' } }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/venues');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('sends JSON:API body and Idempotency-Key on create', async () => {
    setToken('t');
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: '9', type: 'reservations', attributes: {} } }));

    await api.create('/reservations', 'reservations', { name: 'x' }, 'idem-1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-1');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/vnd.api+json');
    expect(JSON.parse(init.body as string)).toEqual({
      data: { type: 'reservations', attributes: { name: 'x' } },
    });
  });

  it('throws ApiError with the first error detail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ errors: [{ code: 'UNPROCESSABLE', detail: 'Name is taken' }] }, 422),
    );
    await expect(api.list('/venues')).rejects.toMatchObject({
      message: 'Name is taken',
      code: 'UNPROCESSABLE',
      status: 422,
    });
    fetchMock.mockResolvedValue(
      jsonResponse({ errors: [{ code: 'UNPROCESSABLE', detail: 'Name is taken' }] }, 422),
    );
    await expect(api.list('/venues')).rejects.toBeInstanceOf(ApiError);
  });

  it('clears the token on 401', async () => {
    setToken('expired');
    fetchMock.mockResolvedValue(jsonResponse({ errors: [{ code: 'UNAUTHENTICATED', detail: 'nope' }] }, 401));
    await expect(api.list('/venues')).rejects.toThrow('nope');
    expect(localStorage.getItem('openplay.venue-portal.token')).toBeNull();
    clearToken();
  });
});
