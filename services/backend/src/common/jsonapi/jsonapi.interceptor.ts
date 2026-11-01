import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { JSONAPI_MEDIA_TYPE, JsonApiDataDocument } from './jsonapi';

/** Successful payloads become { data: ... } with the JSON:API media type. */
@Injectable()
export class JsonApiInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<JsonApiDataDocument> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('content-type', JSONAPI_MEDIA_TYPE);
    return next.handle().pipe(map((data) => ({ data })));
  }
}
