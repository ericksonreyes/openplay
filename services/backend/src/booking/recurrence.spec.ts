import {
  expansionWindowTo,
  EXPANSION_HORIZON_WEEKS,
  nextOccurrences,
  RecurrenceRule,
  validateRule,
} from './recurrence';
import { expandTemplate } from './recurring.service';
import { RecurringReservationTemplateRow } from './booking.types';

const NOW = new Date('2030-01-01T00:00:00.000Z'); // a Tuesday (UTC)

const weekly = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: 'weekly',
  interval_weeks: 1,
  weekdays: ['tue'],
  start_time: '19:00',
  duration_minutes: 60,
  start_date: '2030-01-01',
  ...over,
});

describe('validateRule', () => {
  it('accepts a weekly weekday-list rule', () => {
    expect(validateRule(weekly())).toEqual([]);
  });

  it('rejects bad weekday names, times, and inverted dates', () => {
    expect(validateRule(weekly({ weekdays: ['noday' as never] })).length).toBeGreaterThan(0);
    expect(validateRule(weekly({ start_time: '25:00' })).length).toBeGreaterThan(0);
    expect(
      validateRule(weekly({ start_date: '2030-02-01', end_date: '2030-01-01' })).length,
    ).toBeGreaterThan(0);
    expect(validateRule(weekly({ interval_weeks: 0 })).length).toBeGreaterThan(0);
  });
});

describe('nextOccurrences', () => {
  it('expands every matching weekday inside the window', () => {
    const occ = nextOccurrences(
      weekly({ weekdays: ['tue', 'thu'], start_date: '2030-01-01' }),
      NOW,
      new Date('2030-01-15T00:00:00.000Z'),
    );
    // Tuesdays 1/1 + 1/8, Thursdays 1/3 + 1/10
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      '2030-01-01T19:00:00.000Z',
      '2030-01-03T19:00:00.000Z',
      '2030-01-08T19:00:00.000Z',
      '2030-01-10T19:00:00.000Z',
    ]);
    expect(occ[0].endsAt.toISOString()).toBe('2030-01-01T20:00:00.000Z');
  });

  it('honours interval_weeks anchored at the start_date week', () => {
    const occ = nextOccurrences(
      weekly({ interval_weeks: 2, start_date: '2030-01-07' }), // week of Mon 1/7
      NOW,
      new Date('2030-02-06T00:00:00.000Z'),
    );
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      '2030-01-08T19:00:00.000Z',
      '2030-01-22T19:00:00.000Z',
      '2030-02-05T19:00:00.000Z',
    ]);
  });

  it('stops at end_date (inclusive) and never produces pre-start occurrences', () => {
    const occ = nextOccurrences(
      weekly({ start_date: '2030-01-01', end_date: '2030-01-15' }),
      NOW,
      new Date('2030-03-01T00:00:00.000Z'),
    );
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      '2030-01-01T19:00:00.000Z',
      '2030-01-08T19:00:00.000Z',
      '2030-01-15T19:00:00.000Z',
    ]);
  });

  it('returns nothing for an invalid rule or empty window', () => {
    expect(nextOccurrences(weekly({ weekdays: [] }), NOW, expansionWindowTo(NOW))).toEqual([]);
    expect(
      nextOccurrences(weekly(), new Date('2030-02-01T00:00:00.000Z'), NOW),
    ).toEqual([]);
  });

  it('expansion horizon is eight weeks out', () => {
    expect(expansionWindowTo(NOW).getTime() - NOW.getTime()).toBe(
      EXPANSION_HORIZON_WEEKS * 7 * 24 * 3_600_000,
    );
  });
});

// ---------- expandTemplate (skipped-conflict logic, mocked tx) ----------

const TEMPLATE: RecurringReservationTemplateRow = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 't-1',
  venueId: 'v-1',
  resourceId: 'r-1',
  playerId: 'p-1',
  rule: weekly({ weekdays: ['tue'], start_date: '2030-01-01' }),
  status: 'active',
  createdAt: NOW,
  updatedAt: NOW,
};

interface MockTxOptions {
  closures?: { resourceId: string | null; startsAt: Date; endsAt: Date }[];
  busy?: { startsAt: Date; endsAt: Date; expiresAt: Date | null; ownerType: string; ownerId: string }[];
  existing?: { startsAt: Date }[];
}

const mockTx = (opts: MockTxOptions = {}) => {
  const created: Record<string, unknown>[] = [];
  const tx = {
    venueResource: {
      findFirst: jest.fn(async () => ({
        id: 'r-1',
        tenantId: 't-1',
        venueId: 'v-1',
        status: 'active',
        settings: {},
      })),
    },
    venueClosure: {
      findMany: jest.fn(async () => opts.closures ?? []),
    },
    resourceAllocation: {
      findMany: jest.fn(async () => opts.busy ?? []),
      create: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    reservation: {
      findMany: jest.fn(async () => opts.existing ?? []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: BigInt(created.length), ...data };
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: bigint } }) => ({
        id: where.id,
        uuid: 'uuid',
        tenantId: 't-1',
      })),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    $executeRaw: jest.fn(async () => 0),
  };
  return { tx, created };
};

describe('expandTemplate', () => {
  // Tuesdays at 19:00 within the 8-week horizon from 2030-01-01:
  // 1/1, 1/8, 1/15, 1/22, 1/29, 2/5, 2/12, 2/19 — 8 candidates (2/26 = window edge, excluded).
  const tue = (day: string) => new Date(`2030-${day}T19:00:00.000Z`);

  it('creates an occurrence per free slot', async () => {
    const { tx, created } = mockTx();
    const result = await expandTemplate(tx as never, TEMPLATE, NOW);
    expect(result.occurrences).toHaveLength(8);
    expect(result.skipped).toEqual([]);
    expect(created).toHaveLength(8);
    expect(created[0]['seriesId']).toBe(TEMPLATE.id);
  });

  it('skips occurrences that conflict with existing allocations', async () => {
    const { tx, created } = mockTx({
      busy: [
        {
          startsAt: tue('01-15'),
          endsAt: new Date('2030-01-15T20:00:00.000Z'),
          expiresAt: null,
          ownerType: 'reservation',
          ownerId: 'other',
        },
      ],
    });
    const result = await expandTemplate(tx as never, TEMPLATE, NOW);
    expect(created).toHaveLength(7);
    expect(result.skipped).toEqual([
      { starts_at: '2030-01-15T19:00:00.000Z', reason: 'conflict' },
    ]);
  });

  it('skips occurrences inside a venue closure', async () => {
    const { tx, created } = mockTx({
      closures: [
        {
          resourceId: null,
          startsAt: new Date('2030-01-22T00:00:00.000Z'),
          endsAt: new Date('2030-01-23T00:00:00.000Z'),
        },
      ],
    });
    const result = await expandTemplate(tx as never, TEMPLATE, NOW);
    expect(created).toHaveLength(7);
    expect(result.skipped).toEqual([
      { starts_at: '2030-01-22T19:00:00.000Z', reason: 'closure' },
    ]);
  });

  it('is idempotent — already-materialized occurrences are reported, not re-created', async () => {
    const { tx, created } = mockTx({
      existing: [
        { startsAt: tue('01-01') },
        { startsAt: tue('01-08') },
        { startsAt: tue('01-15') },
        { startsAt: tue('01-22') },
        { startsAt: tue('01-29') },
        { startsAt: tue('02-05') },
        { startsAt: tue('02-12') },
        { startsAt: tue('02-19') },
        { startsAt: tue('02-26') },
      ],
    });
    const result = await expandTemplate(tx as never, TEMPLATE, NOW);
    expect(created).toHaveLength(0);
    expect(result.skipped.every((s) => s.reason === 'exists')).toBe(true);
  });
});
