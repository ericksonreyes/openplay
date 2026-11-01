import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Request-scoped Prisma access. Inside a request transaction (opened by
 * RlsContextInterceptor) this returns the transaction client that carries
 * the RLS context; outside one it returns the base client. Modules must use
 * this — not PrismaService directly — for request-path queries.
 */
@Injectable()
export class ScopedPrisma {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  get client(): TxClient {
    return (this.cls.get<TxClient>('tx') ?? this.prisma) as TxClient;
  }
}
