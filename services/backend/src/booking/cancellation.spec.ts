import { evaluateCancellation, resolvePolicy } from './cancellation';

const START = new Date('2030-01-02T12:00:00.000Z');
const NOW = new Date('2030-01-01T12:00:00.000Z'); // exactly 24h before

describe('resolvePolicy', () => {
  it('defaults to 24h free-cancel, no-show non-refundable', () => {
    expect(resolvePolicy(null)).toEqual({ free_cancel_hours: 24, no_show_refundable: false });
  });

  it('honours venue overrides', () => {
    expect(resolvePolicy({ free_cancel_hours: 4, no_show_refundable: true })).toEqual({
      free_cancel_hours: 4,
      no_show_refundable: true,
    });
  });
});

describe('evaluateCancellation', () => {
  it('fully refunds a player cancel at least 24h before start', () => {
    const o = evaluateCancellation(null, START, NOW, 'player');
    expect(o.refund).toBe('full');
    expect(o.reason).toBe('cancelled_before_cutoff');
  });

  it('refunds nothing for a late player cancel', () => {
    const late = new Date(START.getTime() - 60_000);
    const o = evaluateCancellation(null, START, late, 'player');
    expect(o.refund).toBe('none');
    expect(o.reason).toBe('late_cancel');
  });

  it('always fully refunds a venue cancel, even last-minute', () => {
    const late = new Date(START.getTime() - 60_000);
    const o = evaluateCancellation(null, START, late, 'venue');
    expect(o.refund).toBe('full');
    expect(o.reason).toBe('venue_cancelled');
  });

  it('respects a shorter venue-configured window', () => {
    const twoHoursBefore = new Date(START.getTime() - 2 * 3_600_000);
    const o = evaluateCancellation({ free_cancel_hours: 4 }, START, twoHoursBefore, 'player');
    expect(o.refund).toBe('none');
  });
});
