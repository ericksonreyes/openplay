import {
  canCancel,
  canConfirm,
  HOLD_TTL_MINUTES,
  holdExpiryFrom,
  isHoldExpired,
  isHoldLive,
} from './holds';

const NOW = new Date('2030-01-01T12:00:00.000Z');

describe('hold expiry', () => {
  it('sets expiry HOLD_TTL_MINUTES ahead', () => {
    expect(holdExpiryFrom(NOW).getTime() - NOW.getTime()).toBe(HOLD_TTL_MINUTES * 60_000);
  });

  it('is live only while status=hold and deadline is in the future', () => {
    const future = new Date(NOW.getTime() + 60_000);
    const past = new Date(NOW.getTime() - 60_000);
    expect(isHoldLive('hold', future, NOW)).toBe(true);
    expect(isHoldLive('hold', past, NOW)).toBe(false);
    expect(isHoldLive('confirmed', future, NOW)).toBe(false);
    expect(isHoldLive('hold', null, NOW)).toBe(false);
  });

  it('flags expiry deterministically at the deadline', () => {
    const deadline = new Date(NOW.getTime());
    expect(isHoldExpired('hold', deadline, NOW)).toBe(true);
    expect(isHoldExpired('confirmed', deadline, NOW)).toBe(false);
  });
});

describe('lifecycle transitions', () => {
  it('confirms from hold/pending states only', () => {
    expect(canConfirm('hold')).toBe(true);
    expect(canConfirm('pending_approval')).toBe(true);
    expect(canConfirm('pending_payment')).toBe(true);
    expect(canConfirm('confirmed')).toBe(false);
    expect(canConfirm('cancelled')).toBe(false);
    expect(canConfirm('no_show')).toBe(false);
  });

  it('cancels from any pre-completion state', () => {
    expect(canCancel('hold')).toBe(true);
    expect(canCancel('confirmed')).toBe(true);
    expect(canCancel('completed')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
    expect(canCancel('expired')).toBe(false);
  });
});
