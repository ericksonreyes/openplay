import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { isUuid } from '../common/ids/uuid';
import { ParseSqidPipe } from '../common/ids/parse-id.pipes';
import { SQID_SCOPES } from './commerce.types';
import { requireAmountCents } from './money';
import { serializePayment, serializeRefund } from './serializers';
import {
  idempotencyKeyFrom,
  optionalString,
  optionalUuid,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  requireEnum,
} from './validation';
import { PaymentsService } from './payments.service';
import { SqidCodec } from '../common/ids/sqid';

const sqid = new SqidCodec();

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly actorContext: ActorContextService,
  ) {}

  /**
   * Initiate checkout. Any verified account may pay for itself; the
   * Idempotency-Key header makes retries return the original payment.
   */
  @Post()
  async initiate(
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    const actor = this.actorContext.actor;
    if (!actor.userId) {
      throw new BadRequestException('a player account is required');
    }
    const tenantId = body['tenant_id'];
    if (typeof tenantId !== 'string' || !isUuid(tenantId)) {
      throw new BadRequestException('tenant_id is required');
    }
    const method = requireEnum(body, 'method', PAYMENT_METHODS);
    const { payment } = await this.payments.initiate({
      tenantId,
      payerId: actor.userId,
      purpose: requireEnum(body, 'purpose', PAYMENT_PURPOSES),
      reservationId: optionalUuid(body, 'reservation_id'),
      membershipId: decodeOptionalSqid(body['membership_id'], SQID_SCOPES.membership),
      rentalId: decodeOptionalSqid(body['rental_id'], SQID_SCOPES.rental),
      amountCents: requireAmountCents(body, 'amount_cents', { allowZero: true }),
      currency: optionalString(body, 'currency', 3) ?? 'PHP',
      method,
      idempotencyKey: idempotencyKeyFrom(idemHeader),
      details: body['details'],
    });
    return serializePayment(payment);
  }

  @Get()
  async list() {
    return (await this.payments.listForActor()).map(serializePayment);
  }

  /** Owner (player row) or tenant staff — RLS draws the same boundary. */
  @Get(':id')
  async get(@Param('id', ParseSqidPipe(SQID_SCOPES.payment)) id: bigint) {
    return serializePayment(await this.payments.getById(id));
  }

  @Post(':id/refund')
  @RequirePermissions('payments.manage')
  async refund(
    @Param('id', ParseSqidPipe(SQID_SCOPES.payment)) id: bigint,
    @Body() body: Record<string, unknown>,
  ) {
    const amount = body['amount_cents'];
    const { refund } = await this.payments.refund(id, {
      amountCents:
        amount === undefined
          ? undefined
          : requireAmountCents(body, 'amount_cents'),
      reason: optionalString(body, 'reason'),
    });
    return serializeRefund(refund);
  }
}

function decodeOptionalSqid(value: unknown, scope: string): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException('expected a SQID string');
  }
  const decoded = sqid.decode(scope, value);
  if (decoded === null) {
    throw new BadRequestException('undecodable id');
  }
  return decoded;
}
