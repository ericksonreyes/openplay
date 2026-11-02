import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('filter[from]') from?: string,
    @Query('filter[to]') to?: string,
    @Query('filter[q]') q?: string,
    @Query('sort') sort?: string,
  ) {
    return this.notifications.list(this.actorContext.actor, {
      status,
      limit: limit ? Number(limit) : undefined,
      from,
      to,
      q,
      sort,
    });
  }

  @Get(':id')
  get(@Param('id', ParseUuidPipe) id: string) {
    return this.notifications.get(this.actorContext.actor, id);
  }
}
