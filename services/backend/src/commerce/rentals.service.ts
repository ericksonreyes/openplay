import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { SystemContextService } from '../common/context/system-context.service';
import { CommerceDb, EquipmentItemRow, EquipmentRentalRow } from './commerce.types';
import { nextReference } from './reference.util';
import { assertTransition, RENTAL_TRANSITIONS } from './status';

type Body = Record<string, unknown>;

interface StockRow {
  id: string;
  tenant_id: string;
  total_stock: number;
  claimed: bigint;
}

/**
 * Equipment catalog (tenant-owned) and rentals (player-owned). Stock
 * claims are atomic: the item row is locked FOR NO KEY UPDATE while
 * overlapping active claims are summed, so concurrent renters can never
 * exceed total_stock. The claim interval covers the rental plus its
 * pickup/return windows.
 */
@Injectable()
export class RentalsService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
    private readonly system: SystemContextService,
  ) {}

  private get db(): CommerceDb {
    return this.scoped.client as unknown as CommerceDb;
  }

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private async record(
    streamType: string,
    streamId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tenantId?: string,
  ): Promise<void> {
    await this.audit.append(this.scoped.client, this.actor, {
      streamType,
      streamId,
      eventType,
      tenantId: tenantId ?? this.actor.tenantId,
      payload,
    });
  }

  // ---------- equipment catalog ----------

  listItems(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<EquipmentItemRow[]> {
    return this.db.equipmentItem.findMany({
      where: list?.where,
      orderBy: list?.orderBy ?? { createdAt: 'asc' },
    });
  }

  async getItem(id: string): Promise<EquipmentItemRow> {
    const item = await this.db.equipmentItem.findFirst({ where: { id } });
    if (!item) throw new RecordNotFoundException();
    return item;
  }

  async createItem(data: Body): Promise<EquipmentItemRow> {
    const item = await this.db.equipmentItem.create({ data: { id: newId(), ...data } });
    await this.record('equipment', item.id, 'equipment.created', {
      item: { id: item.id, name: item.name, total_stock: item.totalStock },
    });
    return item;
  }

  async updateItem(id: string, data: Body): Promise<EquipmentItemRow> {
    await this.getItem(id);
    const item = await this.db.equipmentItem.update({ where: { id }, data });
    await this.record('equipment', item.id, 'equipment.updated', {
      item: { id: item.id, total_stock: item.totalStock, status: item.status },
    });
    return item;
  }

  async deleteItem(id: string): Promise<EquipmentItemRow> {
    const item = await this.getItem(id);
    // Draft only: anything past draft, or with rental history, is
    // decommissioned — never deleted.
    if (item.status !== 'draft') {
      throw new ConflictException(
        `${item.name} is ${item.status} — only draft equipment can be deleted; decommission it instead.`,
      );
    }
    const open = await this.db.equipmentRental.count({
      where: { itemId: id, status: { in: ['reserved', 'checked_out'] } },
    });
    if (open > 0) {
      throw new ConflictException(
        `${item.name} has ${open} open rental${open === 1 ? '' : 's'} — return or cancel them first.`,
      );
    }
    const total = await this.db.equipmentRental.count({ where: { itemId: id } });
    if (total > 0) {
      throw new ConflictException(
        `${item.name} has ${total} rental${total === 1 ? '' : 's'} on record — decommission it instead of deleting.`,
      );
    }
    await this.db.equipmentItem.delete({ where: { id } });
    await this.record('equipment', item.id, 'equipment.deleted', { item_id: item.id });
    return item;
  }

  // ---------- rentals ----------

  /**
   * Creates a rental with an atomic quantity claim: lock the item row,
   * sum active claims overlapping [starts_at - pickup window,
   * ends_at + return window], then insert if headroom remains.
   */
  async createRental(input: {
    itemId: string;
    quantity: number;
    startsAt: Date;
    endsAt: Date;
    pickupWindowMinutes?: number;
    returnWindowMinutes?: number;
    reservationId?: string;
    amountCents?: number;
  }): Promise<EquipmentRentalRow> {
    const actor = this.actor;
    if (!actor.userId) {
      throw new BadRequestException('a player account is required');
    }
    const pickup = input.pickupWindowMinutes ?? 15;
    const returnWindow = input.returnWindowMinutes ?? 15;

    // Lock the item row; concurrent claimers serialize on this lock.
    const locked = await this.scoped.client.$queryRaw<StockRow[]>`
      SELECT i."id", i."tenant_id", i."total_stock",
        COALESCE((
          SELECT SUM(r."quantity") FROM "equipment_rentals" r
          WHERE r."item_id" = i."id"
            AND r."status" IN ('reserved','checked_out')
            AND r."starts_at" - (r."pickup_window_minutes" || ' minutes')::interval
                < ${input.endsAt}::timestamptz + (${returnWindow} || ' minutes')::interval
            AND r."ends_at"   + (r."return_window_minutes" || ' minutes')::interval
                > ${input.startsAt}::timestamptz - (${pickup} || ' minutes')::interval
        ), 0) AS "claimed"
      FROM "equipment_items" i
      WHERE i."id" = ${input.itemId}::uuid AND i."status" = 'active'
      FOR NO KEY UPDATE OF i
    `;
    const row = locked[0];
    if (!row) {
      throw new RecordNotFoundException();
    }
    const claimed = Number(row.claimed);
    if (claimed + input.quantity > row.total_stock) {
      throw new ConflictException('insufficient equipment stock for that interval');
    }

    const streamId = newId();
    const reference = await nextReference(this.scoped.client, row.tenant_id, 'rental');
    const rental = await this.db.equipmentRental.create({
      data: {
        streamId,
        tenantId: row.tenant_id,
        itemId: input.itemId,
        renterId: actor.userId,
        reservationId: input.reservationId ?? null,
        reference,
        quantity: input.quantity,
        status: 'reserved',
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        pickupWindowMinutes: pickup,
        returnWindowMinutes: returnWindow,
        amountCents: input.amountCents ?? null,
      },
    });
    await this.record('equipment', streamId, 'equipment.rental_created', {
      rental: { id: rental.id.toString(), reference, quantity: input.quantity, item_id: input.itemId },
    }, row.tenant_id);
    return rental;
  }

  /** Player: own rentals. Tenant staff: tenant rentals. */
  async listRentals(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<EquipmentRentalRow[]> {
    const actor = this.actor;
    const orderBy = list?.orderBy ?? { createdAt: 'desc' as const };
    const rows = actor.tenantId
      ? await this.db.equipmentRental.findMany({
          where: { tenantId: actor.tenantId, ...(list?.where ?? {}) },
          orderBy,
        })
      : await this.db.equipmentRental.findMany({
          where: { renterId: actor.userId, ...(list?.where ?? {}) },
          orderBy,
        });
    await this.hydrateDisplay(rows);
    return rows;
  }

  /** equipment_name + renter_name — see DISPLAY_CONVENTIONS §3. */
  private async hydrateDisplay(rows: EquipmentRentalRow[]): Promise<void> {
    const itemIds = [...new Set(rows.map((r) => r.itemId))];
    const renterIds = [...new Set(rows.map((r) => r.renterId))];
    const [items, renters] = await Promise.all([
      itemIds.length
        ? this.db.equipmentItem.findMany({ where: { id: { in: itemIds } } })
        : Promise.resolve([]),
      renterIds.length
        ? this.system.run((sys) =>
            sys.iamUser.findMany({
              where: { id: { in: renterIds } },
              select: { id: true, displayName: true, email: true, username: true },
            }),
          )
        : Promise.resolve([]),
    ]);
    const itemName = new Map(items.map((i) => [i.id, i.name]));
    const renterName = new Map<string, string | null>(
      renters.map((u): [string, string | null] => [
        u.id,
        u.displayName || u.email || u.username || null,
      ]),
    );
    for (const r of rows) {
      r.equipmentName = itemName.get(r.itemId) ?? null;
      r.renterName = renterName.get(r.renterId) ?? null;
    }
  }

  async getRental(id: bigint): Promise<EquipmentRentalRow> {
    const rental = await this.db.equipmentRental.findFirst({ where: { id } });
    if (!rental) throw new RecordNotFoundException();
    return rental;
  }

  /** Staff records equipment hand-out; item stays unavailable until return. */
  async checkout(id: bigint): Promise<EquipmentRentalRow> {
    const rental = await this.getRental(id);
    assertTransition(RENTAL_TRANSITIONS, rental.status, 'checked_out');
    const updated = await this.db.equipmentRental.update({
      where: { id: rental.id },
      data: { status: 'checked_out', checkedOutAt: new Date() },
    });
    await this.record('equipment', rental.streamId, 'equipment.checked_out', {
      rental_id: rental.id.toString(),
      quantity: rental.quantity,
    }, rental.tenantId);
    return updated;
  }

  /** Staff records return; stock becomes claimable past the return window. */
  async returnRental(id: bigint): Promise<EquipmentRentalRow> {
    const rental = await this.getRental(id);
    assertTransition(RENTAL_TRANSITIONS, rental.status, 'returned');
    const updated = await this.db.equipmentRental.update({
      where: { id: rental.id },
      data: { status: 'returned', returnedAt: new Date() },
    });
    await this.record('equipment', rental.streamId, 'equipment.returned', {
      rental_id: rental.id.toString(),
      quantity: rental.quantity,
    }, rental.tenantId);
    return updated;
  }

  /** Uncollected equipment released per venue no-show policy. */
  async release(id: bigint): Promise<EquipmentRentalRow> {
    const rental = await this.getRental(id);
    assertTransition(RENTAL_TRANSITIONS, rental.status, 'released');
    const updated = await this.db.equipmentRental.update({
      where: { id: rental.id },
      data: { status: 'released' },
    });
    await this.record('equipment', rental.streamId, 'equipment.rental_released', {
      rental_id: rental.id.toString(),
      quantity: rental.quantity,
    }, rental.tenantId);
    return updated;
  }
}
