import { ConflictException } from '@nestjs/common';
import {
  assertTransition,
  canTransition,
  DISPUTE_TRANSITIONS,
  MEMBERSHIP_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  RENTAL_TRANSITIONS,
  REFUND_TRANSITIONS,
} from './status';

describe('status transition guards', () => {
  it('allows the payment happy path and refund paths', () => {
    expect(canTransition(PAYMENT_TRANSITIONS, 'initiated', 'captured')).toBe(true);
    expect(canTransition(PAYMENT_TRANSITIONS, 'awaiting_verification', 'captured')).toBe(true);
    expect(canTransition(PAYMENT_TRANSITIONS, 'captured', 'partially_refunded')).toBe(true);
    expect(canTransition(PAYMENT_TRANSITIONS, 'captured', 'refunded')).toBe(true);
    expect(canTransition(PAYMENT_TRANSITIONS, 'partially_refunded', 'refunded')).toBe(true);
  });

  it('rejects transitions out of terminal payment states', () => {
    for (const terminal of ['failed', 'cancelled', 'expired', 'refunded']) {
      expect(canTransition(PAYMENT_TRANSITIONS, terminal, 'captured')).toBe(false);
      expect(() =>
        assertTransition(PAYMENT_TRANSITIONS, terminal, 'captured'),
      ).toThrow(ConflictException);
    }
  });

  it('keeps the rental lifecycle one-directional', () => {
    expect(canTransition(RENTAL_TRANSITIONS, 'reserved', 'checked_out')).toBe(true);
    expect(canTransition(RENTAL_TRANSITIONS, 'checked_out', 'returned')).toBe(true);
    expect(canTransition(RENTAL_TRANSITIONS, 'returned', 'reserved')).toBe(false);
    expect(canTransition(RENTAL_TRANSITIONS, 'released', 'checked_out')).toBe(false);
  });

  it('allows membership activation only from pending/paused', () => {
    expect(canTransition(MEMBERSHIP_TRANSITIONS, 'pending', 'active')).toBe(true);
    expect(canTransition(MEMBERSHIP_TRANSITIONS, 'paused', 'active')).toBe(true);
    expect(canTransition(MEMBERSHIP_TRANSITIONS, 'expired', 'active')).toBe(false);
  });

  it('enforces the dispute flow open -> under_review -> resolved/escalated', () => {
    expect(canTransition(DISPUTE_TRANSITIONS, 'open', 'under_review')).toBe(true);
    expect(canTransition(DISPUTE_TRANSITIONS, 'under_review', 'resolved')).toBe(true);
    expect(canTransition(DISPUTE_TRANSITIONS, 'under_review', 'escalated')).toBe(true);
    expect(canTransition(DISPUTE_TRANSITIONS, 'escalated', 'resolved')).toBe(true);
    expect(canTransition(DISPUTE_TRANSITIONS, 'resolved', 'open')).toBe(false);
  });

  it('ends manual refunds at recorded -> succeeded, provider refunds at requested -> succeeded', () => {
    expect(canTransition(REFUND_TRANSITIONS, 'requested', 'succeeded')).toBe(true);
    expect(canTransition(REFUND_TRANSITIONS, 'recorded', 'succeeded')).toBe(true);
    expect(canTransition(REFUND_TRANSITIONS, 'succeeded', 'recorded')).toBe(false);
  });
});
