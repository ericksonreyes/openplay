import type { JsonApiResource } from './api';

/** Defensive attribute readers — the contract defines endpoints, not field names. */

export function attr(resource: JsonApiResource | null | undefined, ...keys: string[]): unknown {
  if (!resource) return undefined;
  for (const key of keys) {
    if (resource.attributes[key] !== undefined && resource.attributes[key] !== null) {
      return resource.attributes[key];
    }
  }
  return undefined;
}

export function attrString(resource: JsonApiResource | null | undefined, ...keys: string[]): string {
  const value = attr(resource, ...keys);
  return value === undefined ? '' : String(value);
}

export function displayName(resource: JsonApiResource | null | undefined, fallback = 'Untitled'): string {
  return (
    attrString(resource, 'name', 'title', 'display_name', 'displayName', 'label') || fallback
  );
}

/** Render the remaining attributes as simple key/value rows for detail pages. */
export function attributeEntries(
  resource: JsonApiResource | null | undefined,
  exclude: string[] = [],
): Array<[string, string]> {
  if (!resource) return [];
  return Object.entries(resource.attributes)
    .filter(([key, value]) => !exclude.includes(key) && value !== null && value !== undefined)
    .map(([key, value]) => [
      key.replace(/_/g, ' '),
      typeof value === 'object' ? JSON.stringify(value) : String(value),
    ]);
}

export function formatDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export function formatDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

/** Money is integer minor units — render via Intl currency. */
export function formatMoney(cents: unknown, currency: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  const cur = typeof currency === 'string' && currency ? currency : 'PHP';
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: cur }).format(n / 100);
}
