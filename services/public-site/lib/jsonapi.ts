// Minimal JSON:API helpers shared by server-side fetches and unit tests.

export interface JsonApiResource<A = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: A;
}

export interface JsonApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
}

function isResource(value: unknown): value is JsonApiResource<object> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'attributes' in value &&
    typeof (value as { attributes: unknown }).attributes === 'object'
  );
}

/** Unwrap a single-resource document: {data:{type,id,attributes}} -> {id, ...attributes} */
export function unwrapResource<A extends object>(
  doc: { data?: unknown } | null | undefined,
): ({ id: string } & A) | null {
  const res = doc?.data;
  if (!isResource(res)) return null;
  return { id: res.id, ...(res.attributes as A) };
}

/** Unwrap a collection document: {data:[...]} -> array of {id, ...attributes} */
export function unwrapCollection<A extends object>(
  doc: { data?: unknown } | null | undefined,
): ({ id: string } & A)[] {
  const data = doc?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter(isResource)
    .map((res) => ({ id: res.id, ...(res.attributes as A) }));
}

/** Extract the first human-readable error detail from an error document. */
export function firstErrorDetail(
  doc: { errors?: JsonApiError[] } | null | undefined,
): string | null {
  const err = doc?.errors?.[0];
  return err?.detail ?? err?.title ?? err?.code ?? null;
}
