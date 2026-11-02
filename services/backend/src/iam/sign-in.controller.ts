import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Public } from '../common/auth/public.decorator';
import { SystemContextService } from '../common/context/system-context.service';
import { TokenService } from './token.service';
import { AuthFlowService } from './auth-flow.service';
import { hashCredential } from './credentials';

/** Refresh tokens are single-use, rotated on every /auth/refresh call. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface SignInBody {
  scope?: string;
  tenantCode?: string;
  identifier?: string;
  password?: string;
}

@Controller('auth')
@Public()
export class SignInController {
  constructor(
    private readonly system: SystemContextService,
    private readonly tokens: TokenService,
    private readonly flows: AuthFlowService,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: SignInBody) {
    if (!body?.identifier || !body?.password || (body.scope !== 'platform' && body.scope !== 'tenant')) {
      throw new BadRequestException('scope (platform|tenant), identifier, and password are required');
    }
    if (body.scope === 'tenant' && !body.tenantCode) {
      throw new BadRequestException('tenantCode is required for tenant scope');
    }

    const session = await this.system.run(async (tx) => {
      const user = await this.findUser(tx, body);
      if (
        !user?.passwordHash ||
        user.suspendedAt ||
        !(await bcrypt.compare(body.password!, user.passwordHash))
      ) {
        return null;
      }
      return this.loadSession(tx, user.id);
    });
    if (!session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refresh = await this.system.run((tx) =>
      this.flows.issueToken(tx, {
        userId: session.user.id,
        kind: 'refresh',
        ttlMs: REFRESH_TOKEN_TTL_MS,
      }),
    );

    return this.sessionResponse(session.user, session.roleKeys, session.permissions, session.venueIds, refresh.token);
  }

  /**
   * POST /auth/refresh — exchange a refresh token for a new access token.
   * The presented refresh token is consumed and a new one is issued
   * (single-use rotation, same theft-detection shape as reset tokens).
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refresh_token?: string }) {
    const presented = typeof body?.refresh_token === 'string' ? body.refresh_token : null;
    if (!presented) throw new BadRequestException('refresh_token is required');
    const hash = hashCredential(presented);

    const rotated = await this.system.run(async (tx) => {
      const row = await this.flows.findUsableToken(tx, 'refresh', hash);
      if (!row) return null;
      const session = await this.loadSession(tx, row.user_id);
      if (!session) return null;
      await this.flows.consumeToken(tx, row.id);
      // Opportunistic cleanup — purge this user's dead refresh tokens.
      await tx.$executeRaw`
        DELETE FROM "auth_tokens"
        WHERE "user_id" = ${row.user_id}::uuid
          AND ("consumed_at" IS NOT NULL OR "expires_at" < now())
      `;
      const next = await this.flows.issueToken(tx, {
        userId: row.user_id,
        kind: 'refresh',
        ttlMs: REFRESH_TOKEN_TTL_MS,
      });
      return { session, next };
    });
    if (!rotated) throw new UnauthorizedException('refresh token is invalid or expired');

    const { session, next } = rotated;
    return this.sessionResponse(session.user, session.roleKeys, session.permissions, session.venueIds, next.token);
  }

  /** Shared session assembly: roles + permissions + venue ids for a user id. */
  private async loadSession(tx: Tx, userId: string) {
    const user = await tx.iamUser.findFirst({ where: { id: userId, suspendedAt: null } });
    if (!user) return null;
    const roles = await tx.iamUserRole.findMany({
        where: { userId: user.id },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const roleKeys = roles.map((r) => r.role.key);
      const permissions = [
        ...new Set(roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
      ];
      const venueRows = await tx.$queryRaw<{ venue_id: string }[]>`
        SELECT "venue_id" FROM "staff_venue_assignments" WHERE "user_id" = ${user.id}::uuid
      `;
      return { user, roleKeys, permissions, venueIds: venueRows.map((r) => r.venue_id) };
  }

  private async sessionResponse(
    user: { id: string; scope: string; username: string | null; displayName: string | null; tenantId: string | null },
    roleKeys: string[],
    permissions: string[],
    venueIds: string[],
    refreshToken: string | null,
  ) {
    const { token, expiresIn } = await this.tokens.issue({
      sub: user.id,
      tenantId: user.tenantId ?? undefined,
      roles: roleKeys,
      permissions,
      venueIds,
    });
    return {
      type: 'session',
      id: user.id,
      attributes: {
        token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        refresh_token: refreshToken,
        user: {
          scope: user.scope,
          username: user.username,
          display_name: user.displayName,
          tenant_id: user.tenantId,
        },
      },
    };
  }

  private findUser(tx: Tx, body: SignInBody) {
    if (body.scope === 'platform') {
      return tx.iamUser.findFirst({
        where: { scope: 'platform', OR: [{ email: body.identifier }, { username: body.identifier }] },
      });
    }
    return tx.iamUser.findFirst({
      where: {
        scope: 'tenant',
        username: body.identifier,
        tenant: { code: body.tenantCode },
      },
    });
  }
}
