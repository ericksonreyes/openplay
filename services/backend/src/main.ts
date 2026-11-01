import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { requestIdMiddleware, RequestWithId } from './common/request-id.middleware';
import { ApiExceptionFilter } from './common/errors/http-exception.filter';
import { JsonLogger } from './common/logging/json-logger.service';
import { errorDocument } from './common/jsonapi/jsonapi';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'], bufferLogs: true });
  app.enableCors({ origin: env.corsOrigins });
  app.useBodyParser('json', {
    type: (req) =>
      typeof req.headers['content-type'] === 'string' &&
      req.headers['content-type'].includes('json'),
    limit: '1mb',
  });
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useLogger(app.get(JsonLogger));
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.listen(env.port, '0.0.0.0');
  // Terminal handler so unmatched routes emit the same JSON:API error
  // document as controller exceptions. Must be registered after listen:
  // Nest mounts its routes during listen, and Express runs handlers in
  // registration order.
  app.getHttpAdapter().getInstance().use((req: Request, res: Response) => {
    const doc = errorDocument(404, 'NOT_FOUND', 'Not found',
      (req as Request & RequestWithId).requestId ?? '');
    res.status(404).type('application/vnd.api+json').json(doc);
  });
  Logger.log(`JWT signing mode: ${env.jwtMode}`, 'Bootstrap');
}

bootstrap();
