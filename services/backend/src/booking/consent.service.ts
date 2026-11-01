import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { SystemContextService } from '../common/context/system-context.service';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { CatalogDb, VenueFacilityRuleRow, VenueWaiverDocumentRow, VenueWaiverVersionRow } from '../venue-catalog/catalog.types';
import { BookingDb, ConsentRecordRow } from './booking.types';
import { BookingService } from './booking.service';
import { PrismaClient } from '@prisma/client';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
type Tx = TxClient & BookingDb & CatalogDb;

/**
 * Consent recording: facility-rule acknowledgments and waiver signatures.
 * Records are immutable once written; guests record against their verified
 * contact reference. Reads of the underlying rule/waiver go through system
 * context when the caller has no tenant scope (players consent against
 * published documents across tenants).
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly system: SystemContextService,
    private readonly actorContext: ActorContextService,
    private readonly booking: BookingService,
  ) {}

  /** POST /facility-rules/:id/acknowledge */
  async acknowledgeFacilityRule(
    ruleId: string,
    input: { coveredAction?: string; coveredId?: string; participantName?: string; guardianUserId?: string; guestContactId?: string },
  ): Promise<ConsentRecordRow> {
    const actor = this.actorContext.actor;
    const rule = (await this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      return db.venueFacilityRule.findFirst({ where: { id: ruleId, status: 'published' } });
    })) as VenueFacilityRuleRow | null;
    if (!rule) throw new RecordNotFoundException();
    const userId = input.guestContactId ? null : actor.userId ?? null;
    if (!userId && !input.guestContactId) {
      throw new BadRequestException('a user or verified guest contact is required');
    }
    return this.booking.run((tx) =>
      this.booking.recordConsent(
        tx,
        {
          tenantId: rule.tenantId,
          kind: 'facility_rule',
          facilityRuleId: rule.id,
          facilityRuleVersion: rule.version,
          userId,
          guestContactId: input.guestContactId ?? null,
          participantName: input.participantName ?? null,
          guardianUserId: input.guardianUserId ?? null,
          coveredAction: input.coveredAction ?? 'reservation',
          coveredId: input.coveredId ?? null,
        },
        'consent.rule_acknowledged',
      ),
    );
  }

  /** POST /waivers/:id/sign — :id is the waiver *document*; signs the current published version. */
  async signWaiver(
    documentId: string,
    input: { coveredAction?: string; coveredId?: string; participantName?: string; guardianUserId?: string; guestContactId?: string },
  ): Promise<ConsentRecordRow> {
    const actor = this.actorContext.actor;
    const { doc, version } = await this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      const d = (await db.venueWaiverDocument.findFirst({
        where: { id: documentId, status: 'active' },
      })) as VenueWaiverDocumentRow | null;
      if (!d) return { doc: null, version: null };
      const v = (await db.venueWaiverVersion.findFirst({
        where: { documentId: d.id, version: d.currentVersion, status: 'published' },
      })) as VenueWaiverVersionRow | null;
      return { doc: d, version: v };
    });
    if (!doc || !version) throw new RecordNotFoundException();
    const userId = input.guestContactId ? null : actor.userId ?? null;
    if (!userId && !input.guestContactId) {
      throw new BadRequestException('a user or verified guest contact is required');
    }
    return this.booking.run((tx) =>
      this.booking.recordConsent(
        tx,
        {
          tenantId: doc.tenantId,
          kind: 'waiver',
          waiverDocumentId: doc.id,
          waiverVersionId: version.id,
          userId,
          guestContactId: input.guestContactId ?? null,
          participantName: input.participantName ?? null,
          guardianUserId: input.guardianUserId ?? null,
          coveredAction: input.coveredAction ?? 'reservation',
          coveredId: input.coveredId ?? null,
        },
        'consent.waiver_signed',
      ),
    );
  }

  /** Staff reporting: acknowledgments for a rule / signatures for a document. */
  async listConsents(filter: { facilityRuleId?: string; waiverDocumentId?: string }): Promise<ConsentRecordRow[]> {
    const actor = this.actorContext.actor;
    if (!actor.tenantId && !actor.isPlatform) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const db = this.scoped.client as unknown as Tx;
    const where: Record<string, unknown> = {};
    if (filter.facilityRuleId) where['facilityRuleId'] = filter.facilityRuleId;
    if (filter.waiverDocumentId) where['waiverDocumentId'] = filter.waiverDocumentId;
    return db.consentRecord.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
