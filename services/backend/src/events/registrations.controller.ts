import { Controller, Delete, Param } from '@nestjs/common';
import { ParseSqidPipe } from '../common/ids/parse-id.pipes';
import { EventsService } from './events.service';
import { REGISTRATION_SQID_SCOPE, serializeRegistration } from './serializers';

/** Registration lifecycle: DELETE /registrations/:id cancels (player own or staff). */
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly events: EventsService) {}

  @Delete(':id')
  async cancel(@Param('id', ParseSqidPipe(REGISTRATION_SQID_SCOPE)) id: bigint) {
    return serializeRegistration(await this.events.cancelRegistration(id));
  }
}
