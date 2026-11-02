import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { optionalString } from '../venue-catalog/validation';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { BookingService } from './booking.service';
import { serializeGuestContact } from './serializers';
import { parseListQuery } from '../common/list-query';

/**
 * Staff-facing guest-contact directory — walk-in customers captured at the
 * front desk or through guest booking. Tenant-scoped by RLS.
 */
@Controller('guest-contacts')
export class GuestContactsController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  @RequirePermissions('bookings.manage')
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: { name: 'name', email: 'email', phone: 'phone', created_at: 'createdAt' },
      search: ['name', 'email', 'phone'],
    });
    return (await this.booking.listGuestContacts(list)).map(serializeGuestContact);
  }

  /** Staff: update reachable fields on a guest contact (phone + notes). */
  @Patch(':id')
  @RequirePermissions('bookings.manage')
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const data: { phone?: string; notes?: string } = {};
    const phone = optionalString(body, 'phone', 40);
    const notes = optionalString(body, 'notes', 2000);
    if (phone !== undefined) data.phone = phone;
    if (notes !== undefined) data.notes = notes;
    if (Object.keys(data).length === 0) throw new BadRequestException('no updatable fields');
    return serializeGuestContact(await this.booking.updateGuestContact(id, data));
  }
}
