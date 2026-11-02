import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RecordNotFoundException } from '../common/errors/api-error';
import { resolveTenantId } from '../venue-catalog/validation';
import { parseListQuery } from '../common/list-query';
import { serializeMembershipPlan } from './serializers';
import { MembershipsService } from './memberships.service';
import {
  BILLING_TYPES,
  optionalBoolean,
  optionalEnum,
  optionalInstant,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  PLAN_STATUSES,
  requireString,
  TERM_END_RULES,
} from './validation';
import { requireAmountCents } from './money';

const MANAGE = 'memberships.manage';

@Controller('membership-plans')
export class MembershipPlansController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly actorContext: ActorContextService,
  ) {}

  /** Player browse (active plans) or tenant management list. */
  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    const actor = this.actorContext.actor;
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: { name: 'name', status: 'status', price_cents: 'priceCents', created_at: 'createdAt' },
      search: ['name', 'description'],
    });
    const plans = actor.tenantId
      ? await this.memberships.listPlans(list)
      : await this.memberships.listPlansForBrowse();
    return plans.map(serializeMembershipPlan);
  }

  @Post()
  @RequirePermissions(MANAGE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const plan = await this.memberships.createPlan({
      tenantId,
      venueId: optionalUuid(body, 'venue_id') ?? null,
      includeFutureVenues: body['include_future_venues'] === true,
      name: requireString(body, 'name'),
      description: optionalString(body, 'description'),
      priceCents: requireAmountCents(body, 'price_cents', { allowZero: true }),
      currency: optionalString(body, 'currency', 3) ?? 'PHP',
      termDays: optionalInt(body, 'term_days', 1),
      expiresAt: optionalInstant(body, 'expires_at'),
      termEndRule: optionalEnum(body, 'term_end_rule', TERM_END_RULES),
      billingType: optionalEnum(body, 'billing_type', BILLING_TYPES),
      intervalDays: optionalInt(body, 'interval_days', 1),
      benefits: (optionalJson(body, 'benefits') as object | undefined) ?? {},
      eligibility: optionalJson(body, 'eligibility'),
      status: optionalEnum(body, 'status', PLAN_STATUSES),
    });
    return serializeMembershipPlan(plan);
  }

  @Get(':id')
  async get(@Param('id', ParseUuidPipe) id: string) {
    // Tenant staff read through scope; players get the catalog view only.
    const actor = this.actorContext.actor;
    if (actor.tenantId) {
      return serializeMembershipPlan(await this.memberships.getPlan(id));
    }
    const plans = await this.memberships.listPlansForBrowse();
    const plan = plans.find((p) => p.id === id);
    if (!plan) {
      throw new RecordNotFoundException();
    }
    return serializeMembershipPlan(plan);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const plan = await this.memberships.updatePlan(id, {
      venueId: optionalUuid(body, 'venue_id'),
      includeFutureVenues: optionalBoolean(body, 'include_future_venues'),
      name: body['name'] !== undefined ? requireString(body, 'name') : undefined,
      description: optionalString(body, 'description'),
      priceCents:
        body['price_cents'] !== undefined
          ? requireAmountCents(body, 'price_cents', { allowZero: true })
          : undefined,
      currency: optionalString(body, 'currency', 3),
      termDays: optionalInt(body, 'term_days', 1),
      expiresAt: optionalInstant(body, 'expires_at'),
      termEndRule: optionalEnum(body, 'term_end_rule', TERM_END_RULES),
      billingType: optionalEnum(body, 'billing_type', BILLING_TYPES),
      intervalDays: optionalInt(body, 'interval_days', 1),
      benefits: optionalJson(body, 'benefits'),
      eligibility: optionalJson(body, 'eligibility'),
      status: optionalEnum(body, 'status', PLAN_STATUSES),
    });
    return serializeMembershipPlan(plan);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.memberships.deletePlan(id);
    return { type: 'membership-plan', id, attributes: { deleted: true } };
  }
}
