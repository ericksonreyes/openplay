/**
 * Registration capacity decisions — pure functions, unit-tested without a DB.
 * The atomic claim itself is `SELECT ... FOR NO KEY UPDATE` on the event row
 * plus this check inside the same transaction.
 */

export interface CapacityInput {
  capacity: number;
  waitlistEnabled: boolean;
  status: string; // event status
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

export type RegistrationDecision =
  | { action: 'confirm'; status: 'confirmed' | 'pending' }
  | { action: 'waitlist' }
  | { action: 'reject'; reason: string };

/** Seats currently consumed by active (pending/confirmed) registrations. */
export const seatsTaken = (registrations: { status: string; seats: number }[]): number =>
  registrations
    .filter((r) => r.status === 'confirmed' || r.status === 'pending')
    .reduce((sum, r) => sum + r.seats, 0);

export const nextWaitlistPosition = (
  registrations: { status: string; waitlistPosition: number | null }[],
): number =>
  registrations
    .filter((r) => r.status === 'waitlisted')
    .reduce((max, r) => Math.max(max, r.waitlistPosition ?? 0), 0) + 1;

/** Whether the event currently accepts registrations at all. */
export function registrationOpen(event: CapacityInput, now: Date): string | null {
  if (event.status === 'cancelled') return 'event is cancelled';
  if (event.status === 'complete') return 'event is complete';
  if (event.status === 'draft') return 'event is not published';
  if (event.status === 'registration_closed') return 'registration is closed';
  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    return 'registration has not opened';
  }
  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    return 'registration is closed';
  }
  return null;
}

/**
 * Decide the outcome for a registration request. `paymentTiming` decides
 * whether a claim lands as pending (upfront/deposit hold) or confirmed.
 */
export function decideRegistration(
  event: CapacityInput,
  taken: number,
  requestedSeats: number,
  paymentTiming: string,
  now: Date,
): RegistrationDecision {
  const closed = registrationOpen(event, now);
  if (closed) return { action: 'reject', reason: closed };
  if (requestedSeats < 1) return { action: 'reject', reason: 'seats must be >= 1' };
  const remaining = event.capacity - taken;
  if (requestedSeats <= remaining) {
    return {
      action: 'confirm',
      status: paymentTiming === 'full' || paymentTiming === 'deposit' ? 'pending' : 'confirmed',
    };
  }
  if (event.waitlistEnabled) return { action: 'waitlist' };
  return { action: 'reject', reason: 'event is full' };
}
