import { friendlyError } from './errors';
export const API_ROOT = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const API_BASE = `${API_ROOT}/api/v1`;

const TOKEN_KEY = 'openplay.platform.token';
const REFRESH_KEY = 'openplay.platform.refresh';

export const getToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
};
export const setRefreshToken = (t: string): void => sessionStorage.setItem(REFRESH_KEY, t);
export const getRefreshToken = (): string | null => sessionStorage.getItem(REFRESH_KEY);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface JsonApiErrorObject {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

interface JsonApiDocument<T = unknown> {
  data?: T;
  errors?: JsonApiErrorObject[];
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** JSON:API resource type for the request document. */
  type?: string;
  /** JSON:API attributes payload; sent as {data:{type,attributes}}. */
  attributes?: Record<string, unknown>;
}

/**
 * JSON:API fetch wrapper (ADR-0011). Sends `application/vnd.api+json`,
 * attaches the Bearer token, unwraps `{data}`, and throws ApiError with the
 * first error object's detail on failure. A 401 clears the token and sends
 * the user back to /sign-in.
 */
export interface Resource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

/** String-coerced attribute read for display/search. Booleans and numbers
 *  become their string form — use `rawAttr` for gates and comparisons. */
export function attr(r: Resource | null | undefined, key: string): string {
  const v = r?.attributes?.[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Raw attribute read — boolean/number/object gates must use this, not `attr`. */
export function rawAttr(r: Resource | null | undefined, key: string): unknown {
  return r?.attributes?.[key];
}

/** In-flight request counter → drives the chrome loading glow. */
let pendingRequests = 0;
const loadingListeners = new Set<(pending: number) => void>();
export function subscribeLoading(cb: (pending: number) => void): () => void {
  loadingListeners.add(cb);
  return () => loadingListeners.delete(cb);
}
const bumpLoading = (delta: number) => {
  pendingRequests = Math.max(0, pendingRequests + delta);
  for (const cb of loadingListeners) cb(pendingRequests);
};

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', type = 'request', attributes } = options;
  bumpLoading(1);

  const headers: Record<string, string> = { accept: 'application/vnd.api+json' };
  const token = getToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (attributes !== undefined) {
    headers['content-type'] = 'application/vnd.api+json';
    body = JSON.stringify({ data: { type, attributes } });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  } catch {
    throw new ApiError(0, 'UNAVAILABLE', 'Cannot reach the OpenPlay API. Is the backend running?');
  }

  // Expired access token → one silent refresh + retry before giving up.
  if (res.status === 401 && !path.startsWith('/auth/') && (await tryRefresh())) {
    const h2 = { ...headers, authorization: `Bearer ${getToken()}` };
    try {
      res = await fetch(`${API_BASE}${path}`, { method, headers: h2, body });
    } catch {
      throw new ApiError(0, 'UNAVAILABLE', 'Cannot reach the OpenPlay API. Is the backend running?');
    }
  }

  const doc = (await res.json().catch(() => null)) as JsonApiDocument<T> | null;

  try {
    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        if (window.location.pathname !== '/sign-in') {
          window.location.assign('/sign-in');
        }
      }
      const err = doc?.errors?.[0];
      throw new ApiError(
        res.status,
        err?.code ?? 'INTERNAL',
        friendlyError(err?.code, err?.detail, err?.meta) ?? `Request failed with status ${res.status}.`,
      );
    }

    return doc?.data as T;
  } finally {
    bumpLoading(-1);
  }
}

/* ---- typed helpers ---- */

export interface TenantApplication {
  owner_name: string;
  owner_email: string;
  message: string | null;
  submitted_at: string;
}

export interface TenantAttributes {
  code: string;
  name: string;
  status: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  application?: TenantApplication | null;
}

export interface TenantResource {
  type: 'tenants';
  id: string;
  attributes: TenantAttributes;
}

export interface SessionUser {
  scope: string;
  username: string | null;
  display_name: string | null;
  tenant_id: string | null;
}

export interface Session {
  id: string;
  attributes: {
    token: string;
    token_type: string;
    expires_in: number;
    user: SessionUser;
  };
}

export function signIn(identifier: string, password: string): Promise<Session> {
  return apiFetch<Session>('/auth/sign-in', {
    method: 'POST',
    type: 'session',
    attributes: { scope: 'platform', identifier, password },
  });
}

/** Single-flight refresh — POST /auth/refresh with the stored refresh token. */
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/vnd.api+json', accept: 'application/vnd.api+json' },
        body: JSON.stringify({ data: { type: 'session', attributes: { refresh_token: rt } } }),
      });
      if (!r.ok) return false;
      const doc = (await r.json()) as { data?: { attributes?: { token?: string; refresh_token?: string } } };
      const t = doc?.data?.attributes?.token;
      if (!t) return false;
      setToken(t);
      if (doc.data!.attributes!.refresh_token) setRefreshToken(doc.data!.attributes!.refresh_token!);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}


export function listTenants(status?: string): Promise<TenantResource[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<TenantResource[]>(`/platform/tenants${q}`);
}

export function getTenant(id: string): Promise<TenantResource> {
  return apiFetch<TenantResource>(`/platform/tenants/${encodeURIComponent(id)}`);
}

export function transitionTenant(
  id: string,
  action: 'approve' | 'suspend' | 'restore',
  fields: { reason?: string; purpose?: string },
): Promise<TenantResource> {
  const attributes: Record<string, unknown> = {};
  if (fields.reason?.trim()) attributes.reason = fields.reason.trim();
  if (fields.purpose?.trim()) attributes.purpose = fields.purpose.trim();
  return apiFetch<TenantResource>(`/platform/tenants/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    type: 'tenant_transition',
    attributes,
  });
}

export function platformPing(): Promise<{ type: string; id: string; attributes: { ok: boolean } }> {
  return apiFetch('/platform/ping');
}
