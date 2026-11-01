import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ActorContextService } from '../common/auth/actor-context.service';
import { Public } from '../common/auth/public.decorator';
import { TenantsService } from './tenants.service';
import { validateTenantSubmission } from './tenants.validation';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly actorContext: ActorContextService,
  ) {}

  /** Public business onboarding submission (multi-tenant review path). */
  @Post()
  @Public()
  @HttpCode(202)
  submit(@Body() body: unknown) {
    return this.tenants.submit(validateTenantSubmission(body), this.actorContext.actor);
  }

  /** The calling tenant actor's own business record. */
  @Get('current')
  current() {
    return this.tenants.current(this.actorContext.actor);
  }

  /** Owner-editable profile fields (name + details profile). */
  @Patch('current')
  @RequirePermissions('venue.config.manage')
  updateCurrent(@Body() body: Record<string, unknown>) {
    return this.tenants.updateCurrent(this.actorContext.actor, {
      name: typeof body?.name === 'string' ? body.name : undefined,
      details: body?.details,
    });
  }
}
