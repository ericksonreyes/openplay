import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { ActorContextService } from '../common/auth/actor-context.service';
import { publicActor } from '../common/auth/actor';
import { Public } from '../common/auth/public.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { AuditService } from '../common/audit/audit.service';
import { SystemContextService } from '../common/context/system-context.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { isUuid } from '../common/ids/uuid';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { parseListQuery } from '../common/list-query';
import { AuthFlowService } from './auth-flow.service';
import { hashCredential, INVITE_TOKEN_TTL_MS, requirePassword } from './credentials';
import {
  requireAssignableStaffRole,
  requireInvitableRole,
} from './scopes';
import { TokenService } from './token.service';

const MANAGE = 'venue.config.manage';
const READ = 'bookings.view';
const GENERIC_INVITE_ERROR = 'Invalid or expired invite token';

interface InviteBody {
  username?: string;
  displayName?: string;
  role?: string;
  venueIds?: string[];
}

const staffResource = (row: {
  id: string;
  username: string | null;
  displayName: string | null;
  passwordHash: string | null;
  roles: string[];
  venueIds: string[];
}) => ({
  type: 'staff',
  id: row.id,
  attributes: {
    username: row.username,
    display_name: row.displayName,
    roles: row.roles,
    venue_ids: row.venueIds,
    status: row.passwordHash ? 'active' : 'invited',
  },
});

/**
 * Tenant staff management: owner/manager invites scoped staff, the invitee
 * accepts with the emailed token, and staff lists/updates run inside the
 * tenant's RLS context.
 */
@Controller('staff')
export class StaffController {
  constructor(
    private readonly system: SystemContextService,
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly flow: AuthFlowService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  @Post('invite')
  @RequirePermissions(MANAGE)
  @HttpCode(202)
  async invite(@Body() body: InviteBody) {
    const actor = this.actorContext.actor;
    if (!actor.tenantId) {
      throw new BadRequestException('tenant context is required');
    }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!username) {
      throw new BadRequestException('username is required');
    }
    const role = requireInvitableRole(body?.role);
    const displayName =
      typeof body?.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : null;
    const rawVenues = body?.venueIds ?? [];
    if (!Array.isArray(rawVenues) || rawVenues.some((v) => !isUuid(v))) {
      throw new BadRequestException('venueIds must be an array of UUIDs');
    }
    const venueIds = rawVenues as string[];

    const tenantId = actor.tenantId;
    const outcome = await this.system.run(async (tx) => {
      const taken = await tx.iamUser.findFirst({
        where: { scope: 'tenant', username },
        select: { id: true },
      });
      if (taken) {
        return 'username-taken' as const;
      }
      if (venueIds.length) {
        const [{ n }] = await tx.$queryRaw<[{ n: bigint }]>`
          SELECT COUNT(*)::bigint AS n FROM "venues"
          WHERE "tenant_id" = ${tenantId}::uuid AND "id" = ANY(${venueIds}::uuid[])
        `;
        if (Number(n) !== new Set(venueIds).size) {
          return 'bad-venues' as const;
        }
      }
      const roleRow = await tx.iamRole.findUnique({ where: { key: role } });
      if (!roleRow) {
        throw new BadRequestException(`unknown role: ${role}`);
      }
      const user = await tx.iamUser.create({
        data: {
          id: uuidv7(),
          scope: 'tenant',
          tenantId,
          username,
          displayName,
        },
      });
      await tx.iamUserRole.create({ data: { userId: user.id, roleId: roleRow.id } });
      for (const venueId of new Set(venueIds)) {
        await tx.$executeRaw`
          INSERT INTO "staff_venue_assignments" ("user_id", "venue_id")
          VALUES (${user.id}::uuid, ${venueId}::uuid)
        `;
      }
      const issued = await this.flow.issueToken(tx, {
        userId: user.id,
        kind: 'invite',
        ttlMs: INVITE_TOKEN_TTL_MS,
      });
      await this.flow.queueAuthEmail(tx, {
        tenantId,
        recipientUserId: user.id,
        recipientAddress: null, // staff email is optional; the row is the delivery record
        kind: 'auth.invite',
        payload: {
          link: `https://openplay.local/invite/accept?token=${issued.token}`,
          expires_in_hours: 72,
        },
        idempotencyKey: `auth.invite:${issued.tokenId}`,
      });
      await this.audit.append(tx, actor, {
        streamType: 'iam_user',
        streamId: user.id,
        eventType: 'staff.invited',
        tenantId,
        payload: { username, role, venue_ids: venueIds },
      });
      return { userId: user.id };
    });

    if (outcome === 'username-taken') {
      throw new BadRequestException('username is not available');
    }
    if (outcome === 'bad-venues') {
      throw new BadRequestException('venueIds must belong to this business');
    }
    return {
      type: 'staff_invite',
      id: outcome!.userId,
      attributes: { status: 'invited', username, role },
    };
  }

  @Post('invite/accept')
  @Public()
  @HttpCode(200)
  async accept(@Body() body: { token?: string; password?: string }) {
    if (typeof body?.token !== 'string' || !body.token) {
      throw new BadRequestException(GENERIC_INVITE_ERROR);
    }
    const password = requirePassword(body?.password);
    const tokenHash = hashCredential(body.token);

    const session = await this.system.run(async (tx) => {
      const row = await this.flow.findUsableToken(tx, 'invite', tokenHash);
      if (!row) {
        return null;
      }
      await this.flow.consumeToken(tx, row.id); // marks the invite accepted
      const user = await tx.iamUser.update({
        where: { id: row.user_id },
        data: { passwordHash: await bcrypt.hash(password, 10) },
      });
      const roles = await tx.iamUserRole.findMany({
        where: { userId: user.id },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const venueIds = await this.flow.venueIdsFor(tx, user.id);
      await this.audit.append(tx, publicActor(), {
        streamType: 'iam_user',
        streamId: user.id,
        eventType: 'staff.invite_accepted',
        tenantId: user.tenantId ?? undefined,
        payload: { username: user.username },
      });
      return {
        user,
        roleKeys: roles.map((r) => r.role.key),
        permissions: [
          ...new Set(roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
        ],
        venueIds,
      };
    });
    if (!session) {
      throw new BadRequestException(GENERIC_INVITE_ERROR);
    }

    const { token, expiresIn } = await this.tokens.issue({
      sub: session.user.id,
      tenantId: session.user.tenantId ?? undefined,
      roles: session.roleKeys,
      permissions: session.permissions,
      venueIds: session.venueIds,
    });
    return {
      type: 'session',
      id: session.user.id,
      attributes: {
        token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        user: {
          scope: session.user.scope,
          username: session.user.username,
          display_name: session.user.displayName,
          tenant_id: session.user.tenantId,
        },
      },
    };
  }

  @Get()
  @RequirePermissions(READ)
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: {
        display_name: 'displayName',
        username: 'username',
        created_at: 'createdAt',
      },
      search: ['displayName', 'username', 'email'],
    });
    const users = await this.scoped.client.iamUser.findMany({
      where: { scope: 'tenant', ...(list.where ?? {}) },
      include: { roles: { include: { role: true } } },
      orderBy: list.orderBy ?? { createdAt: 'asc' },
    });
    const out: ReturnType<typeof staffResource>[] = [];
    for (const u of users) {
      out.push(
        staffResource({
          ...u,
          roles: u.roles.map((r) => r.role.key),
          venueIds: await this.flow.venueIdsFor(this.scoped.client, u.id),
        }),
      );
    }
    return out;
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const actor = this.actorContext.actor;
    const db = this.scoped.client;
    const user = await db.iamUser.findFirst({ where: { id, scope: 'tenant' } });
    if (!user) {
      throw new RecordNotFoundException();
    }

    const displayName =
      body?.['displayName'] !== undefined
        ? typeof body['displayName'] === 'string' && body['displayName'].trim()
          ? body['displayName'].trim()
          : null
        : undefined;
    const role = body?.['role'] !== undefined ? requireAssignableStaffRole(body['role']) : undefined;
    let venueIds: string[] | undefined;
    if (body?.['venueIds'] !== undefined) {
      if (!Array.isArray(body['venueIds']) || body['venueIds'].some((v) => !isUuid(v))) {
        throw new BadRequestException('venueIds must be an array of UUIDs');
      }
      venueIds = body['venueIds'] as string[];
    }

    if (role !== undefined) {
      const roleRow = await db.iamRole.findUnique({ where: { key: role } });
      if (!roleRow) {
        throw new BadRequestException(`unknown role: ${role}`);
      }
      await db.iamUserRole.deleteMany({ where: { userId: user.id } });
      await db.iamUserRole.create({ data: { userId: user.id, roleId: roleRow.id } });
    }
    if (displayName !== undefined) {
      await db.iamUser.update({ where: { id: user.id }, data: { displayName } });
    }
    if (venueIds !== undefined) {
      // RLS hides other tenants' venues; a count mismatch means a bad id.
      if (venueIds.length && actor.tenantId) {
        const [{ n }] = await db.$queryRaw<[{ n: bigint }]>`
          SELECT COUNT(*)::bigint AS n FROM "venues"
          WHERE "id" = ANY(${venueIds}::uuid[])
        `;
        if (Number(n) !== new Set(venueIds).size) {
          throw new BadRequestException('venueIds must belong to this business');
        }
      }
      await db.$executeRaw`
        DELETE FROM "staff_venue_assignments" WHERE "user_id" = ${user.id}::uuid
      `;
      for (const venueId of new Set(venueIds)) {
        await db.$executeRaw`
          INSERT INTO "staff_venue_assignments" ("user_id", "venue_id")
          VALUES (${user.id}::uuid, ${venueId}::uuid)
        `;
      }
    }

    const refreshed = await db.iamUser.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
    return staffResource({
      ...refreshed,
      roles: refreshed.roles.map((r) => r.role.key),
      venueIds: await this.flow.venueIdsFor(db, user.id),
    });
  }
}
