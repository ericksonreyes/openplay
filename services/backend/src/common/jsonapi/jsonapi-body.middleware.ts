import type { Request } from 'express';

interface JsonApiDocument {
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

/**
 * Rewrites a JSON:API request document ({data: {type, id, attributes,
 * relationships}}) into the plain field map controllers consume. Flat
 * bodies pass through untouched (ADR-0011).
 */
export function unwrapJsonApiBody(req: Request): void {
  const body = req.body as JsonApiDocument | undefined;
  const data = body?.data;
  if (data && typeof data === 'object' && data.attributes && typeof data.attributes === 'object') {
    req.body = {
      ...data.attributes,
      ...(data.id !== undefined ? { id: data.id } : {}),
      ...(data.relationships ? { relationships: data.relationships } : {}),
    };
  }
}
