import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { isUuid } from '../common/ids/uuid';
import { ParseSqidPipe } from '../common/ids/parse-id.pipes';
import { SQID_SCOPES } from './commerce.types';
import { serializeDispute, serializeDisputeMessage } from './serializers';
import { DisputesService } from './disputes.service';
import {
  DISPUTE_CATEGORIES,
  DISPUTE_SUBJECT_TYPES,
  optionalJson,
  requireEnum,
  requireString,
} from './validation';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  /** Player opens a dispute on their own record. */
  @Post()
  async open(@Body() body: Record<string, unknown>) {
    const tenantId = body['tenant_id'];
    if (typeof tenantId !== 'string' || !isUuid(tenantId)) {
      throw new BadRequestException('tenant_id is required');
    }
    const dispute = await this.disputes.open({
      tenantId,
      category: requireEnum(body, 'category', DISPUTE_CATEGORIES),
      subjectType: requireEnum(body, 'subject_type', DISPUTE_SUBJECT_TYPES),
      subjectId: requireString(body, 'subject_id', 200),
      account: requireString(body, 'account', 5000),
      attachments: optionalJson(body, 'attachments'),
    });
    return serializeDispute(dispute);
  }

  @Get()
  async list() {
    return (await this.disputes.listDisputes()).map((d) => serializeDispute(d));
  }

  @Get(':id')
  async get(@Param('id', ParseSqidPipe(SQID_SCOPES.dispute)) id: bigint) {
    const { dispute, messages } = await this.disputes.getDispute(id);
    return serializeDispute(dispute, messages);
  }

  /** Either side responds — venue staff or the opener. */
  @Post(':id/respond')
  async respond(
    @Param('id', ParseSqidPipe(SQID_SCOPES.dispute)) id: bigint,
    @Body() body: Record<string, unknown>,
  ) {
    const message = await this.disputes.respond(id, {
      body: requireString(body, 'body', 5000),
      attachments: optionalJson(body, 'attachments'),
    });
    return serializeDisputeMessage(message);
  }

  /** Refund decisions stay owner-only; resolution needs disputes.manage. */
  @Post(':id/resolve')
  @RequirePermissions('disputes.manage')
  async resolve(
    @Param('id', ParseSqidPipe(SQID_SCOPES.dispute)) id: bigint,
    @Body() body: Record<string, unknown>,
  ) {
    const dispute = await this.disputes.resolve(
      id,
      requireString(body, 'resolution', 2000),
    );
    return serializeDispute(dispute);
  }

  /** Escalation is open to the opener and to venue staff. */
  @Post(':id/escalate')
  async escalate(
    @Param('id', ParseSqidPipe(SQID_SCOPES.dispute)) id: bigint,
    @Body() body: Record<string, unknown>,
  ) {
    const dispute = await this.disputes.escalate(
      id,
      requireString(body, 'reason', 2000),
    );
    return serializeDispute(dispute);
  }
}
