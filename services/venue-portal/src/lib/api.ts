const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const API_ROOT = `${BASE}/api/v1`;
const MEDIA_TYPE = 'application/vnd.api+json';
const TOKEN_KEY = 'openplay.venue-portal.token';
const REFRESH_KEY = 'openplay.venue-portal.refresh';

export interface Resource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export function setRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_KEY, token);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

type Attrs = Record<string, unknown>;

interface RequestOptions {
  method?: string;
  type?: string;
  attributes?: Attrs;
  idempotencyKey?: string;
  rawBody?: unknown;
}

/** Exchange the stored refresh token for a new access token (single-use rotation). */
let refreshing: Promise<boolean> | null = null;
export async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const token = getRefreshToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_ROOT}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': MEDIA_TYPE, Accept: MEDIA_TYPE },
        body: JSON.stringify({ data: { type: 'session', attributes: { refresh_token: token } } }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { data?: { attributes?: { token?: string; refresh_token?: string } } };
      const a = json.data?.attributes;
      if (!a?.token) return false;
      setToken(a.token);
      if (a.refresh_token) setRefreshToken(a.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: MEDIA_TYPE };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = JSON.stringify(options.rawBody);
  } else if (options.attributes !== undefined && options.type) {
    body = JSON.stringify({ data: { type: options.type, attributes: options.attributes } });
  }
  if (body !== undefined) headers['Content-Type'] = MEDIA_TYPE;

  let res = await fetch(`${API_ROOT}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  // Access token expired → try one silent refresh, then retry the call.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const h2: Record<string, string> = { ...headers, Authorization: `Bearer ${getToken()}` };
      res = await fetch(`${API_ROOT}${path}`, { method: options.method ?? 'GET', headers: h2, body });
    }
  }

  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/auth/')) {
      window.location.assign('/sign-in');
    }
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as { data?: T; errors?: { code?: string; detail?: string }[] }) : {};

  if (!res.ok) {
    const err = json.errors?.[0];
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.detail ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const api = {
  list: async (path: string, params?: Record<string, string | undefined>) => {
    const qs = params
      ? '?' +
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
          .join('&')
      : '';
    const data = await request<Resource[] | Resource>(`${path}${qs}`);
    // Collection endpoints return an array; aggregate endpoints (e.g.
    // /schedule) return a single resource whose attributes carry the
    // rows — normalize by taking the first array-valued attribute.
    if (Array.isArray(data)) {
      return data;
    }
    const attrs = (data as Resource)?.attributes ?? {};
    const firstArray = Object.values(attrs).find((v) => Array.isArray(v));
    return (firstArray as Resource[] | undefined) ?? [];
  },
  get: (path: string) => request<Resource>(path),
  getRaw: <T>(path: string) => request<T>(path),
  create: (path: string, type: string, attributes: Attrs, idempotencyKey?: string) =>
    request<Resource>(path, { method: 'POST', type, attributes, idempotencyKey }),
  update: (path: string, type: string, attributes: Attrs) =>
    request<Resource>(path, { method: 'PATCH', type, attributes }),
  remove: (path: string) => request<null>(path, { method: 'DELETE' }),
  action: (path: string, attributes?: Attrs, type?: string, idempotencyKey?: string) =>
    request<Resource>(path, { method: 'POST', type, attributes, idempotencyKey }),
  post: <T>(path: string, rawBody: unknown) =>
    request<T>(path, { method: 'POST', rawBody }),
};

/** Extract a display string from a resource attribute. */
export function attr(r: Resource | null | undefined, key: string): string {
  const v = r?.attributes?.[key];
  if (v === null || v === undefined) return '';
  return String(v);
}
