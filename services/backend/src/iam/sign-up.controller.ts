import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { publicActor } from '../common/auth/actor';
import { Public } from '../common/auth/public.decorator';
import { AuditService } from '../common/audit/audit.service';
import { SystemContextService } from '../common/context/system-context.service';
import { requirePassword } from './credentials';
import { TokenService } from './token.service';
import { AuthFlowService } from './auth-flow.service';
import { REFRESH_TOKEN_TTL_MS } from './sign-in.controller';

interface SignUpBody {
  email?: string;
  password?: string;
  displayName?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Platform-scope self-registration (players). Duplicate emails return the
 * same response shape with `token: null` — no 409, no "email taken" signal;
 * a second user row is never created ((scope, email) uniqueness).
 */
@Controller('auth')
@Public()
export class SignUpController {
  constructor(
    private readonly system: SystemContextService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly flows: AuthFlowService,
  ) {}

  @Post('sign-up')
  @HttpCode(200)
  async signUp(@Body() body: SignUpBody) {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email)) {
      throw new BadRequestException('a valid email is required');
    }
    const password = requirePassword(body?.password);
    const displayName =
      typeof body?.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : null;

    const result = await this.system.run(async (tx) => {
      const existing = await tx.iamUser.findFirst({
        where: { scope: 'platform', email },
        select: { id: true },
      });
      if (existing) {
        return null;
      }
      const playerRole = await tx.iamRole.findUnique({
        where: { key: 'player' },
        include: { permissions: { include: { permission: true } } },
      });
      const user = await tx.iamUser.create({
        data: {
          id: uuidv7(),
          scope: 'platform',
          email,
          passwordHash: await bcrypt.hash(password, 10),
          displayName,
        },
      });
      if (playerRole) {
        await tx.iamUserRole.create({
          data: { userId: user.id, roleId: playerRole.id },
        });
      }
      await this.audit.append(tx, publicActor(), {
        streamType: 'iam_user',
        streamId: user.id,
        eventType: 'user.registered',
        payload: { scope: 'platform', roles: playerRole ? ['player'] : [] },
      });
      const permissions = playerRole
        ? playerRole.permissions.map((p) => p.permission.key)
        : [];
      return { user, roleKeys: playerRole ? ['player'] : [], permissions };
    });

    if (!result) {
      // Non-revealing duplicate: same resource shape, no credential issued.
      return {
        type: 'session',
        id: uuidv7(),
        attributes: {
          token: null,
          token_type: 'Bearer',
          expires_in: 0,
          user: { scope: 'platform', username: null, display_name: displayName, tenant_id: null },
        },
      };
    }

    const refresh = await this.system.run((tx) =>
      this.flows.issueToken(tx, {
        userId: result.user.id,
        kind: 'refresh',
        ttlMs: REFRESH_TOKEN_TTL_MS,
      }),
    );

    const { token, expiresIn } = await this.tokens.issue({
      sub: result.user.id,
      roles: result.roleKeys,
      permissions: result.permissions,
    });

    return {
      type: 'session',
      id: result.user.id,
      attributes: {
        token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        refresh_token: refresh.token,
        user: {
          scope: result.user.scope,
          username: result.user.username,
          display_name: result.user.displayName,
          tenant_id: result.user.tenantId,
        },
      },
    };
  }
}
