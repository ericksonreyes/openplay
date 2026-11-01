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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const raw: string | string[] =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      detail = Array.isArray(raw) ? raw.join('; ') : raw;
    } else {
      this.logger.error(
        `unhandled error request_id=${req.requestId ?? '-'}: ${(exception as Error)?.stack ?? exception}`,
      );
    }

    res
      .status(status)
      .type(JSONAPI_MEDIA_TYPE)
      .json(errorDocument(status, STATUS_CODES[status] ?? 'INTERNAL', detail, req.requestId ?? ''));
  }
}
