import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableCors({ origin: env.corsOrigins });
  app.enableShutdownHooks();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;
    next();
  });
  await app.listen(env.port, '0.0.0.0');
  new Logger('Bootstrap').log(`JWT signing mode: ${env.jwtMode}`);
}

bootstrap();
