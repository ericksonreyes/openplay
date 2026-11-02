export const JSONAPI_MEDIA_TYPE = 'application/vnd.api+json';

export interface JsonApiErrorObject {
  status: string;
  code: string;
  title: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface JsonApiErrorDocument {
  errors: JsonApiErrorObject[];
}

export interface JsonApiDataDocument<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
}

export function errorDocument(
  status: number,
  code: string,
  detail: string,
  requestId: string,
  meta?: Record<string, unknown>,
): JsonApiErrorDocument {
  return {
    errors: [
      {
        status: String(status),
        code,
        title: code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        detail,
        meta: { ...(meta ?? {}), request_id: requestId },
      },
    ],
  };
}
