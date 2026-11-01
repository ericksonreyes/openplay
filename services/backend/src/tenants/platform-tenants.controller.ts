import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { TenantsService } from './tenants.service';
import { validateTransition } from './tenants.validation';

@Controller('platform/tenants')
@RequirePermissions('platform.tenants.manage')
export class PlatformTenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.tenants.listForPlatform(status);
  }

  @Get(':id')
  get(@Param('id', ParseUuidPipe) id: string) {
    return this.tenants.getForPlatform(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseUuidPipe) id: string, @Body() body: unknown) {
    return this.tenants.transition(
      id,
      'approve',
      validateTransition(body, {
        reasonRequired: false,
        defaultPurpose: 'platform tenant review: approve',
      }),
      this.actorContext.actor,
    );
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@Param('id', ParseUuidPipe) id: string, @Body() body: unknown) {
    return this.tenants.transition(
      id,
      'suspend',
      validateTransition(body, {
        reasonRequired: true,
        defaultPurpose: 'platform tenant review: suspend',
      }),
      this.actorContext.actor,
    );
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@Param('id', ParseUuidPipe) id: string, @Body() body: unknown) {
    return this.tenants.transition(
      id,
      'restore',
      validateTransition(body, {
        reasonRequired: false,
        defaultPurpose: 'platform tenant review: restore',
      }),
      this.actorContext.actor,
    );
  }
}
