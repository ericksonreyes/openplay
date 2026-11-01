import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { optionalString, optionalUuid } from '../venue-catalog/validation';
import { ConsentService } from './consent.service';
import { serializeConsentRecord } from './serializers';

const consentInput = (body: Record<string, unknown>) => ({
  coveredAction: optionalString(body, 'covered_action', 50),
  coveredId: optionalUuid(body, 'covered_id'),
  participantName: optionalString(body, 'participant_name', 200),
  guardianUserId: optionalUuid(body, 'guardian_user_id'),
  guestContactId: optionalUuid(body, 'guest_contact_id'),
});

/** Consent records: acknowledge flagged facility rules, sign waiver versions. */
@Controller()
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Post('facility-rules/:id/acknowledge')
  async acknowledge(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    return serializeConsentRecord(await this.consent.acknowledgeFacilityRule(id, consentInput(body)));
  }

  @Post('waivers/:id/sign')
  async sign(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    return serializeConsentRecord(await this.consent.signWaiver(id, consentInput(body)));
  }

  @Get('facility-rules/:id/acknowledgments')
  @RequirePermissions('bookings.view')
  async acknowledgments(@Param('id', ParseUuidPipe) id: string) {
    return (await this.consent.listConsents({ facilityRuleId: id })).map(serializeConsentRecord);
  }

  @Get('waiver-documents/:id/signatures')
  @RequirePermissions('bookings.view')
  async signatures(@Param('id', ParseUuidPipe) id: string) {
    return (await this.consent.listConsents({ waiverDocumentId: id })).map(serializeConsentRecord);
  }
}
