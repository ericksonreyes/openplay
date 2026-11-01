/**
 * Hold expiry rules — pure functions, shared by the reservation lifecycle.
 * Holds are temporary claims during checkout/approval windows; expiry
 * releases the slot deterministically and an expired hold is never silently
 * reclaimed (CONCURRENCY_AND_RESOURCE_CONFLICTS).
 */

export const HOLD_TTL_MINUTES = 15;

export const holdExpiryFrom = (now: Date): Date =>
  new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);

/** A hold is live only while status = 'hold' and its deadline is in the future. */
export const isHoldLive = (
  status: string,
  holdExpiresAt: Date | null,
  now: Date,
): boolean =>
  status === 'hold' && holdExpiresAt !== null && holdExpiresAt.getTime() > now.getTime();

export const isHoldExpired = (
  status: string,
  holdExpiresAt: Date | null,
  now: Date,
): boolean =>
  status === 'hold' && holdExpiresAt !== null && holdExpiresAt.getTime() <= now.getTime();

/** Statuses that still occupy (or may come to occupy) the resource. */
export const ACTIVE_RESERVATION_STATUSES = new Set([
  'hold',
  'pending_approval',
  'pending_payment',
  'confirmed',
]);

/** Reservations that may still transition to a live state. */
export const canConfirm = (status: string): boolean =>
  status === 'hold' || status === 'pending_approval' || status === 'pending_payment';

export const canCancel = (status: string): boolean =>
  status === 'hold' ||
  status === 'pending_approval' ||
  status === 'pending_payment' ||
  status === 'confirmed';
