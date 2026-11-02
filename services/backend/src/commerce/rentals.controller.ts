import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { isUuid } from '../common/ids/uuid';
import { ParseSqidPipe } from '../common/ids/parse-id.pipes';
import { parseListQuery } from '../common/list-query';
import { SQID_SCOPES } from './commerce.types';
import { optionalInt, optionalUuid, requireInstant } from './validation';
import { serializeRental } from './serializers';
import { RentalsService } from './rentals.service';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  /** Player standalone/add-on rental — quantity claim is atomic. */
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const itemId = body['item_id'];
    if (typeof itemId !== 'string' || !isUuid(itemId)) {
      throw new BadRequestException('item_id is required');
    }
    const startsAt = requireInstant(body, 'starts_at');
    const endsAt = requireInstant(body, 'ends_at');
    if (endsAt <= startsAt) {
      throw new BadRequestException('ends_at must be after starts_at');
    }
    const quantity = optionalInt(body, 'quantity', 1) ?? 1;
    const rental = await this.rentals.createRental({
      itemId,
      quantity,
      startsAt,
      endsAt,
      pickupWindowMinutes: optionalInt(body, 'pickup_window_minutes', 0),
      returnWindowMinutes: optionalInt(body, 'return_window_minutes', 0),
      reservationId: optionalUuid(body, 'reservation_id'),
      amountCents: optionalInt(body, 'amount_cents', 0),
    });
    return serializeRental(rental);
  }

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'startsAt',
      sortable: {
        reference: 'reference',
        status: 'status',
        quantity: 'quantity',
        starts_at: 'startsAt',
        created_at: 'createdAt',
      },
      search: ['reference'],
    });
    return (await this.rentals.listRentals(list)).map(serializeRental);
  }

  @Get(':id')
  async get(@Param('id', ParseSqidPipe(SQID_SCOPES.rental)) id: bigint) {
    return serializeRental(await this.rentals.getRental(id));
  }

  @Post(':id/checkout')
  @RequirePermissions('rentals.manage')
  async checkout(@Param('id', ParseSqidPipe(SQID_SCOPES.rental)) id: bigint) {
    return serializeRental(await this.rentals.checkout(id));
  }

  @Post(':id/return')
  @RequirePermissions('rentals.manage')
  async markReturned(@Param('id', ParseSqidPipe(SQID_SCOPES.rental)) id: bigint) {
    return serializeRental(await this.rentals.returnRental(id));
  }

  @Post(':id/release')
  @RequirePermissions('rentals.manage')
  async release(@Param('id', ParseSqidPipe(SQID_SCOPES.rental)) id: bigint) {
    return serializeRental(await this.rentals.release(id));
  }
}
