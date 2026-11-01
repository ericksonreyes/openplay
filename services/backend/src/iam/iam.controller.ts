import { Controller, Get } from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';

@Controller()
export class IamController {
  constructor(private readonly actorContext: ActorContextService) {}

  @Get('me')
  me() {
    const actor = this.actorContext.actor;
    return {
      type: 'actor',
      id: actor.userId,
      attributes: {
        tenant_id: actor.tenantId ?? null,
        roles: actor.roles,
        permissions: actor.permissions,
        venue_ids: actor.venueIds,
        is_platform: actor.isPlatform,
      },
    };
  }

  @Get('platform/ping')
  @RequirePermissions('platform.tenants.manage')
  platformPing() {
    return { type: 'ping', id: 'platform', attributes: { ok: true } };
  }
}
