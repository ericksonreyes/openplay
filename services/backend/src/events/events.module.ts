import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { RegistrationsController } from './registrations.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController, RegistrationsController],
  providers: [EventsService],
})
export class EventsModule {}
