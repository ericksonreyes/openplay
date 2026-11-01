// Server-side calls go over the shared Docker network; browser calls use the
// published localhost port (NEXT_PUBLIC_API_URL).
export function apiBaseUrl(): string {
  return process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000';
}

const PUBLIC_PREFIX = '/api/v1/public';

interface JsonApiDocument {
  data?: unknown;
  errors?: unknown[];
}

/**
 * Server-side JSON:API GET against the public API.
 * Returns the raw document on success, null on network/HTTP failure.
 * Errors documents are returned as-is so callers can surface `detail`.
 */
export async function jsonApiGet(
  path: string,
  options: { revalidate?: number } = {},
): Promise<JsonApiDocument | null> {
  const url = `${apiBaseUrl()}${PUBLIC_PREFIX}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: options.revalidate ?? 60 },
    });
    const body = (await res.json().catch(() => null)) as JsonApiDocument | null;
    if (!res.ok) {
      return body && Array.isArray(body.errors) ? body : null;
    }
    return body;
  } catch {
    return null;
  }
}

export function playerPortalUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL ?? 'http://localhost:3001';
  return `${base}${path}`;
}
