import {
  decideRegistration,
  nextWaitlistPosition,
  registrationOpen,
  seatsTaken,
} from './capacity';

const NOW = new Date('2030-01-01T12:00:00.000Z');

const event = (over: Partial<Parameters<typeof decideRegistration>[0]> = {}) => ({
  capacity: 4,
  waitlistEnabled: false,
  status: 'registration_open',
  registrationOpensAt: null,
  registrationClosesAt: null,
  ...over,
});

describe('seatsTaken', () => {
  it('counts pending + confirmed seats only', () => {
    const regs = [
      { status: 'confirmed', seats: 2 },
      { status: 'pending', seats: 1 },
      { status: 'waitlisted', seats: 3 },
      { status: 'cancelled', seats: 5 },
    ];
    expect(seatsTaken(regs)).toBe(3);
  });
});

describe('nextWaitlistPosition', () => {
  it('queues after the last waitlisted registration', () => {
    expect(
      nextWaitlistPosition([
        { status: 'waitlisted', waitlistPosition: 1 },
        { status: 'waitlisted', waitlistPosition: 3 },
        { status: 'confirmed', waitlistPosition: null },
      ]),
    ).toBe(4);
    expect(nextWaitlistPosition([])).toBe(1);
  });
});

describe('registrationOpen', () => {
  it('rejects cancelled/complete/draft events', () => {
    expect(registrationOpen(event({ status: 'cancelled' }), NOW)).toMatch('cancelled');
    expect(registrationOpen(event({ status: 'complete' }), NOW)).toMatch('complete');
    expect(registrationOpen(event({ status: 'draft' }), NOW)).toMatch('not published');
  });

  it('respects the registration window', () => {
    const e = event({
      registrationOpensAt: new Date(NOW.getTime() + 60_000),
    });
    expect(registrationOpen(e, NOW)).toMatch('not opened');
    const closing = event({ registrationClosesAt: new Date(NOW.getTime() - 60_000) });
    expect(registrationOpen(closing, NOW)).toMatch('closed');
  });
});

describe('decideRegistration', () => {
  it('confirms within capacity for free/later payment', () => {
    expect(decideRegistration(event(), 2, 2, 'free', NOW)).toEqual({
      action: 'confirm',
      status: 'confirmed',
    });
    expect(decideRegistration(event(), 0, 1, 'later', NOW)).toEqual({
      action: 'confirm',
      status: 'confirmed',
    });
  });

  it('holds a pending place for upfront/deposit payment', () => {
    expect(decideRegistration(event(), 0, 1, 'full', NOW)).toEqual({
      action: 'confirm',
      status: 'pending',
    });
    expect(decideRegistration(event(), 0, 1, 'deposit', NOW)).toEqual({
      action: 'confirm',
      status: 'pending',
    });
  });

  it('rejects when full without a waitlist', () => {
    expect(decideRegistration(event(), 4, 1, 'free', NOW)).toEqual({
      action: 'reject',
      reason: 'event is full',
    });
    expect(decideRegistration(event(), 3, 2, 'free', NOW)).toEqual({
      action: 'reject',
      reason: 'event is full',
    });
  });

  it('waitlists instead of rejecting when enabled', () => {
    expect(decideRegistration(event({ waitlistEnabled: true }), 4, 1, 'free', NOW)).toEqual({
      action: 'waitlist',
    });
  });

  it('rejects invalid seat counts and closed registration', () => {
    expect(decideRegistration(event(), 0, 0, 'free', NOW)).toEqual({
      action: 'reject',
      reason: 'seats must be >= 1',
    });
    expect(decideRegistration(event({ status: 'cancelled' }), 0, 1, 'free', NOW).action).toBe('reject');
  });
});
