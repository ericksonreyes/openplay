import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Explicit service-context bypass (`app.is_system`). For code paths with no
 * user context — sign-in lookups, workers, seeds — never ambient privilege:
 * every call is greppable. The initiating user/business still belongs in
 * audit metadata.
 */
@Injectable()
export class SystemContextService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.is_system', 'true', true)
      `;
      return fn(tx);
    });
  }
}
