import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, envelope, jsonApi } from './api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/vnd.api+json' },
  });
}

afterEach(() => fetchMock.mockReset());

describe('jsonApi', () => {
  it('unwraps the JSON:API data envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: { type: 'venues', id: 'v1', attributes: { name: 'Court A' } } }),
    );
    const data = await jsonApi('/venues/v1');
    expect(data).toMatchObject({ type: 'venues', id: 'v1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/venues/v1');
    expect(init.headers.Accept).toBe('application/vnd.api+json');
  });

  it('sends Bearer token and JSON:API content-type on writes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: { type: 'reservations', id: 'r1', attributes: {} } }));
    await jsonApi('/reservations', {
      method: 'POST',
      token: 'jwt-123',
      idempotencyKey: 'key-1',
      body: envelope('reservations', { venue_id: 'v1' }),
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(init.headers['Content-Type']).toBe('application/vnd.api+json');
    expect(init.headers['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(init.body)).toEqual({ data: { type: 'reservations', attributes: { venue_id: 'v1' } } });
  });

  it('throws ApiError with errors[0].detail', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { errors: [{ status: '403', code: 'FORBIDDEN', detail: 'Not allowed' }] }),
    );
    await expect(jsonApi('/venues')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Not allowed',
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('returns null on 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(jsonApi('/registrations/x', { method: 'DELETE', token: 't' })).resolves.toBeNull();
  });

  it('handles unknown error payloads gracefully', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    const err = await jsonApi('/me').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('INTERNAL');
  });
});
