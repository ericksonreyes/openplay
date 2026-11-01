/**
 * Cancellation/refund policy evaluation — pure functions. The defaults from
 * PRIVATE_RESERVATIONS: full refund >=24h before start, none for late cancel
 * or no-show, full on venue cancel. Venues may override `free_cancel_hours`;
 * the resolved policy is snapshotted onto the reservation before payment.
 * Evaluation happens here; refund execution belongs to Commerce.
 */

export interface CancellationPolicy {
  free_cancel_hours: number; // default 24
  no_show_refundable: boolean; // default false
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  free_cancel_hours: 24,
  no_show_refundable: false,
};

export type CancelActor = 'player' | 'guest' | 'venue' | 'system';

export interface CancellationOutcome {
  policy: CancellationPolicy;
  cancelled_by: CancelActor;
  refund: 'full' | 'none';
  reason: string;
}

export function resolvePolicy(raw: unknown): CancellationPolicy {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    free_cancel_hours:
      typeof p['free_cancel_hours'] === 'number' && p['free_cancel_hours'] >= 0
        ? (p['free_cancel_hours'] as number)
        : DEFAULT_CANCELLATION_POLICY.free_cancel_hours,
    no_show_refundable:
      typeof p['no_show_refundable'] === 'boolean'
        ? (p['no_show_refundable'] as boolean)
        : DEFAULT_CANCELLATION_POLICY.no_show_refundable,
  };
}

/**
 * Evaluate the refund outcome for cancelling `startsAt` at `now`.
 * Venue-initiated cancels always refund in full; player/guest cancels refund
 * only when made at least `free_cancel_hours` before start.
 */
export function evaluateCancellation(
  rawPolicy: unknown,
  startsAt: Date,
  now: Date,
  cancelledBy: CancelActor,
): CancellationOutcome {
  const policy = resolvePolicy(rawPolicy);
  if (cancelledBy === 'venue' || cancelledBy === 'system') {
    return {
      policy,
      cancelled_by: cancelledBy,
      refund: 'full',
      reason: 'venue_cancelled',
    };
  }
  const cutoff = new Date(startsAt.getTime() - policy.free_cancel_hours * 3_600_000);
  const refundable = now <= cutoff;
  return {
    policy,
    cancelled_by: cancelledBy,
    refund: refundable ? 'full' : 'none',
    reason: refundable ? 'cancelled_before_cutoff' : 'late_cancel',
  };
}
