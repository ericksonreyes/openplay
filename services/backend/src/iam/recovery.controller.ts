import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { publicActor } from '../common/auth/actor';
import { Public } from '../common/auth/public.decorator';
import { AuditService } from '../common/audit/audit.service';
import { SystemContextService } from '../common/context/system-context.service';
import { AuthFlowService } from './auth-flow.service';
import { hashCredential, RECOVERY_TOKEN_TTL_MS, requirePassword } from './credentials';
import { recoveryTarget, requireScope } from './scopes';

interface RecoverBody {
  scope?: string;
  tenantCode?: string;
  identifier?: string;
}

interface ResetBody {
  token?: string;
  password?: string;
}

const GENERIC_RESET_ERROR = 'Invalid or expired reset token';

/**
 * Non-revealing recovery (security/IDENTITY_AND_ACCESS.MD): /recover always
 * answers 202 with the same body whether or not the identifier resolved;
 * reset tokens are single-use, 30-minute, bound to (scope, user) via
 * auth_tokens.user_id. Local-dev delivery = an 'auth.recovery' notification
 * row the worker sends through Mailpit.
 */
@Controller('auth')
@Public()
export class RecoveryController {
  constructor(
    private readonly system: SystemContextService,
    private readonly flow: AuthFlowService,
    private readonly audit: AuditService,
  ) {}

  @Post('recover')
  @HttpCode(202)
  async recover(@Body() body: RecoverBody) {
    const scope = requireScope(body?.scope);
    const target = recoveryTarget({
      scope,
      tenantCode: body?.tenantCode,
      identifier: body?.identifier,
    });

    if (target) {
      await this.system.run(async (tx) => {
        const user = await tx.iamUser.findFirst({
          where:
            target.scope === 'platform'
              ? { scope: 'platform', email: target.email }
              : {
                  scope: 'tenant',
                  tenant: { code: target.tenantCode },
                  ...(target.email ? { email: target.email } : { username: target.username }),
                },
        });
        if (!user) {
          return; // same 202 — never disclose existence
        }
        const issued = await this.flow.issueToken(tx, {
          userId: user.id,
          kind: 'recovery',
          ttlMs: RECOVERY_TOKEN_TTL_MS,
        });
        await this.flow.queueAuthEmail(tx, {
          tenantId: user.tenantId,
          recipientUserId: user.id,
          recipientAddress: user.email,
          kind: 'auth.recovery',
          payload: {
            link: `https://openplay.local/reset?token=${issued.token}`,
            expires_in_minutes: 30,
          },
          idempotencyKey: `auth.recovery:${issued.tokenId}`,
        });
        await this.audit.append(tx, publicActor(), {
          streamType: 'iam_user',
          streamId: user.id,
          eventType: 'user.password_reset_requested',
          tenantId: user.tenantId ?? undefined,
          payload: { scope, delivered: Boolean(user.email) },
        });
      });
    }

    return { type: 'recovery', id: 'recovery', attributes: { status: 'accepted' } };
  }

  @Post('reset')
  @HttpCode(200)
  async reset(@Body() body: ResetBody) {
    if (typeof body?.token !== 'string' || !body.token) {
      throw new BadRequestException(GENERIC_RESET_ERROR);
    }
    const password = requirePassword(body?.password);
    const tokenHash = hashCredential(body.token);

    const userId = await this.system.run(async (tx) => {
      const row = await this.flow.findUsableToken(tx, 'recovery', tokenHash);
      if (!row) {
        return null;
      }
      await this.flow.consumeToken(tx, row.id);
      const passwordHash = await bcrypt.hash(password, 10);
      await tx.iamUser.update({ where: { id: row.user_id }, data: { passwordHash } });
      const user = await tx.iamUser.findUniqueOrThrow({ where: { id: row.user_id } });
      await this.audit.append(tx, publicActor(), {
        streamType: 'iam_user',
        streamId: user.id,
        eventType: 'user.password_reset',
        tenantId: user.tenantId ?? undefined,
        payload: { scope: user.scope },
      });
      return row.user_id;
    });

    if (!userId) {
      throw new BadRequestException(GENERIC_RESET_ERROR);
    }
    return { type: 'password_reset', id: userId, attributes: { status: 'updated' } };
  }
}
