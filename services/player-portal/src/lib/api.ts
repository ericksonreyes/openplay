import { friendlyError } from './errors';
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const MEDIA_TYPE = 'application/vnd.api+json';

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface JsonApiErrorObject {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  meta?: { request_id?: string };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, error: JsonApiErrorObject) {
    super(error.detail ?? error.title ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code ?? 'INTERNAL';
    this.requestId = error.meta?.request_id;
  }
}

export interface JsonApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
}

/**
 * JSON:API-aware fetch wrapper for the OpenPlay backend.
 * - Prefixes `/api/v1`, sends the JSON:API media type and optional Bearer token.
 * - Unwraps `{ data: ... }` on success; throws `ApiError` with `errors[0].detail`
 *   as the message on failure.
 * - Returns `null` for empty (204) responses.
 */

export async function jsonApi<T = JsonApiResource | JsonApiResource[] | null>(
  path: string,
  options: JsonApiOptions = {},
): Promise<T> {
  try {
    return await fetchJson<T>(path, options);
  } catch (e) {
    // Expired access token → one silent refresh, then retry once.
    if (e instanceof ApiError && e.status === 401 && !path.startsWith('/auth/')) {
      if (await tryRefresh()) {
        const { getToken } = await import('../auth/token');
        return fetchJson<T>(path, { ...options, token: getToken() });
      }
    }
    throw e;
  }
}

/** Single-flight refresh — POST /auth/refresh, rotate stored credentials. */
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const { getRefreshToken, setToken, setRefreshToken } = await import('../auth/token');
      const rt = getRefreshToken();
      if (!rt) return false;
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE },
        body: JSON.stringify(envelope('session', { refresh_token: rt })),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { data?: { attributes?: { token?: string; refresh_token?: string } } };
      const t = json.data?.attributes?.token;
      if (!t) return false;
      setToken(t);
      if (json.data!.attributes!.refresh_token) setRefreshToken(json.data!.attributes!.refresh_token!);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function fetchJson<T = JsonApiResource | JsonApiResource[] | null>(
  path: string,
  options: JsonApiOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, idempotencyKey } = options;

  const headers: Record<string, string> = { Accept: MEDIA_TYPE };
  if (body !== undefined) headers['Content-Type'] = MEDIA_TYPE;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error: JsonApiErrorObject = payload?.errors?.[0] ?? {};
    throw new ApiError(response.status, { ...error, detail: friendlyError(error.code, error.detail, error.meta) });
  }

  return (payload?.data ?? null) as T;
}

/** Build a JSON:API request document for POST/PATCH calls. */
export function envelope(
  type: string,
  attributes: Record<string, unknown>,
  id?: string,
): { data: { type: string; attributes: Record<string, unknown>; id?: string } } {
  return { data: { type, attributes, ...(id ? { id } : {}) } };
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
