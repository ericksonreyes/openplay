import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaClient } from '@prisma/client';
import { from, lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestActor } from '../auth/actor';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Runs the request's database work inside one transaction whose first
 * statements copy verified claims into RLS context. Values come only from
 * the verified actor — never request input.
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const actor = this.cls.get<RequestActor>('actor');
    if (!actor) {
      return next.handle();
    }
    return from(
      this.prisma.$transaction(async (tx) => {
        await applyContext(tx, actor);
        this.cls.set('tx', tx);
        return lastValueFrom(next.handle());
      }),
    );
  }
}

async function applyContext(tx: Tx, actor: RequestActor): Promise<void> {
  await tx.$executeRaw`
    SELECT
      set_config('app.actor_id',    ${actor.userId ?? ''},       true),
      set_config('app.tenant_id',   ${actor.tenantId ?? ''},     true),
      set_config('app.is_platform', ${String(actor.isPlatform)}, true),
      set_config('app.is_system',   ${String(actor.isSystem)},   true),
      set_config('app.is_public',   ${String(actor.isPublic)},   true)
  `;
}
