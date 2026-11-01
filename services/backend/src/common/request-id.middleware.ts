import type { NextFunction, Request, Response } from 'express';
import { ClsServiceManager } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';

export interface RequestWithId {
  requestId?: string;
}

/**
 * First middleware in the chain: opens the request's cls context, assigns
 * the request id, and echoes it on the response. Everything downstream —
 * guards, the RLS interceptor, services — shares this context.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cls = ClsServiceManager.getClsService();
  cls.run(() => {
    const requestId = randomUUID();
    cls.set('requestId', requestId);
    (req as Request & RequestWithId).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
}
