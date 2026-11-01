/**
 * Actor-scope decisions — pure functions so permission/ownership rules are
 * unit-testable. RLS enforces the same rules at the database level; these are
 * the application-side checks used before reads/writes that cross contexts.
 */

export interface ActorLike {
  userId?: string;
  tenantId?: string;
  isPlatform: boolean;
  isSystem?: boolean;
}

export interface OwnedRow {
  tenantId: string;
  playerId: string | null;
  guestContactId?: string | null;
}

/** Tenant staff (or platform) vs. a platform-scope player/guest. */
export const isStaffActor = (actor: ActorLike): boolean =>
  Boolean(actor.tenantId) || actor.isPlatform || actor.isSystem === true;

/** May this actor view/operate the row? Own subject or matching tenant staff. */
export const canAccessOwnedRow = (actor: ActorLike, row: OwnedRow): boolean =>
  actor.isPlatform ||
  actor.isSystem === true ||
  (actor.tenantId !== undefined && actor.tenantId === row.tenantId) ||
  (actor.userId !== undefined && actor.userId === row.playerId);

/** Player rows: only the owner may read; tenant staff read via tenant match. */
export const canViewAsPlayer = (actor: ActorLike, row: OwnedRow): boolean =>
  actor.tenantId === undefined && actor.userId === row.playerId;
