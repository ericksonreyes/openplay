import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { errorDocument, JSONAPI_MEDIA_TYPE } from '../jsonapi/jsonapi';
import { RequestWithId } from '../request-id.middleware';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  503: 'UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & RequestWithId>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Internal server error';
    let code: string | undefined;
    let meta: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown> & { message?: string | string[] };
      const raw: string | string[] =
        typeof body === 'string' ? body : (body.message ?? exception.message);
      detail = Array.isArray(raw) ? raw.join('; ') : raw;
      if (typeof body === 'object' && body !== null) {
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.meta === 'object' && body.meta !== null) {
          meta = body.meta as Record<string, unknown>;
        }
      }
    } else {
      // Database constraints are the last line of defense (ADR-0015) —
      // surface FK violations as a readable conflict, never a raw 500.
      const prismaErr = exception as { code?: string; meta?: { field_name?: string } };
      if (prismaErr?.code === 'P2003') {
        status = HttpStatus.CONFLICT;
        detail = 'This record is still referenced by other records.';
        code = 'CONFLICT';
      } else {
        this.logger.error(
          `unhandled error request_id=${req.requestId ?? '-'}: ${(exception as Error)?.stack ?? exception}`,
        );
      }
    }

    res
      .status(status)
      .type(JSONAPI_MEDIA_TYPE)
      .json(errorDocument(status, code ?? STATUS_CODES[status] ?? 'INTERNAL', detail, req.requestId ?? '', meta));
  }
}
