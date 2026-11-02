import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ParseSqidPipe } from '../common/ids/parse-id.pipes';
import { parseListQuery } from '../common/list-query';
import { SQID_SCOPES } from './commerce.types';
import { serializeMembership, serializePayment } from './serializers';
import { MembershipsService } from './memberships.service';
import {
  idempotencyKeyFrom,
  optionalBoolean,
  PAYMENT_METHODS,
  requireEnum,
} from './validation';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  /** Player purchase — creates a pending membership plus its payment. */
  @Post()
  async purchase(
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    const planId = typeof body['plan_id'] === 'string' ? body['plan_id'] : '';
    const { membership, payment } = await this.memberships.purchase(planId, {
      method: requireEnum(body, 'method', PAYMENT_METHODS),
      autoRenew: optionalBoolean(body, 'auto_renew'),
      idempotencyKey: idempotencyKeyFrom(idemHeader),
    });
    return {
      type: 'membership-purchase',
      id: membership.qrToken.slice(0, 12),
      attributes: {
        membership: serializeMembership(membership),
        payment: serializePayment(payment),
      },
    };
  }

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: {
        reference: 'reference',
        status: 'status',
        starts_at: 'startsAt',
        ends_at: 'endsAt',
        created_at: 'createdAt',
      },
      search: ['reference'],
    });
    return (await this.memberships.listMine(list)).map(serializeMembership);
  }

  @Get(':id')
  async get(@Param('id', ParseSqidPipe(SQID_SCOPES.membership)) id: bigint) {
    return serializeMembership(await this.memberships.getMembership(id));
  }
}
