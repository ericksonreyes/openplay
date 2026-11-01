import { ConflictException } from '@nestjs/common';

/**
 * Status transition guards. The maps are the single source of truth for
 * lifecycle edges; services call assertTransition before every update so
 * an out-of-order write is always a 409, never a silent overwrite.
 */

export const PAYMENT_TRANSITIONS: Record<string, readonly string[]> = {
  initiated: ['awaiting_verification', 'captured', 'failed', 'cancelled', 'expired'],
  awaiting_verification: ['captured', 'failed', 'cancelled', 'expired'],
  captured: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  failed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export const MEMBERSHIP_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['active', 'cancelled', 'expired'],
  active: ['paused', 'expired', 'cancelled'],
  paused: ['active', 'expired', 'cancelled'],
  expired: [],
  cancelled: [],
};

export const RENTAL_TRANSITIONS: Record<string, readonly string[]> = {
  reserved: ['checked_out', 'released', 'cancelled'],
  checked_out: ['returned'],
  returned: [],
  released: [],
  cancelled: [],
};

export const DISPUTE_TRANSITIONS: Record<string, readonly string[]> = {
  open: ['under_review', 'resolved', 'escalated'],
  under_review: ['resolved', 'escalated'],
  escalated: ['resolved'],
  resolved: [],
};

export const REFUND_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ['succeeded', 'failed', 'rejected'],
  recorded: ['succeeded'],
  succeeded: [],
  failed: [],
  rejected: [],
};

export function canTransition(
  map: Record<string, readonly string[]>,
  from: string,
  to: string,
): boolean {
  return (map[from] ?? []).includes(to);
}

export function assertTransition(
  map: Record<string, readonly string[]>,
  from: string,
  to: string,
): void {
  if (!canTransition(map, from, to)) {
    throw new ConflictException(`invalid status transition: ${from} -> ${to}`);
  }
}
