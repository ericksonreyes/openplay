import {
  bufferedWindow,
  computeSlots,
  overlaps,
  resolveGridSettings,
} from './availability';

const DAY = new Date('2030-06-01T00:00:00.000Z');
const NOW = new Date('2030-05-01T00:00:00.000Z'); // before the grid day

const at = (hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(DAY.getTime() + (h * 60 + m) * 60_000);
};

describe('overlaps (half-open intervals)', () => {
  it('detects overlapping windows', () => {
    expect(overlaps({ startsAt: at('10:00'), endsAt: at('11:00') }, { startsAt: at('10:30'), endsAt: at('11:30') })).toBe(true);
  });

  it('treats touching boundaries as non-overlapping', () => {
    expect(overlaps({ startsAt: at('10:00'), endsAt: at('11:00') }, { startsAt: at('11:00'), endsAt: at('12:00') })).toBe(false);
  });
});

describe('bufferedWindow', () => {
  it('extends ends_at by the buffer', () => {
    const w = bufferedWindow(at('10:00'), at('11:00'), 15);
    expect(w.endsAt).toEqual(at('11:15'));
    expect(w.startsAt).toEqual(at('10:00'));
  });
});

describe('resolveGridSettings', () => {
  it('applies defaults for missing settings', () => {
    expect(resolveGridSettings(null)).toEqual({
      open_minutes: 480,
      close_minutes: 1320,
      increment_minutes: 30,
      duration_minutes: 60,
      buffer_minutes: 0,
    });
  });

  it('reads venue-configured values', () => {
    const g = resolveGridSettings({ open_minutes: 600, duration_minutes: 90, buffer_minutes: 10 });
    expect(g.open_minutes).toBe(600);
    expect(g.duration_minutes).toBe(90);
    expect(g.buffer_minutes).toBe(10);
    expect(g.increment_minutes).toBe(30);
  });
});

describe('computeSlots', () => {
  const settings = {
    open_minutes: 8 * 60,
    close_minutes: 11 * 60,
    increment_minutes: 60,
    duration_minutes: 60,
    buffer_minutes: 0,
  };

  it('produces one slot per increment inside operating hours', () => {
    const slots = computeSlots(DAY, settings, [], NOW);
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.starts_at)).toEqual([
      at('08:00').toISOString(),
      at('09:00').toISOString(),
      at('10:00').toISOString(),
    ]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('marks slots overlapping a busy interval unavailable', () => {
    const busy = [{ startsAt: at('09:00'), endsAt: at('10:00') }];
    const slots = computeSlots(DAY, settings, busy, NOW);
    expect(slots.map((s) => s.available)).toEqual([true, false, true]);
  });

  it('counts the buffer against adjacent slots', () => {
    const withBuffer = { ...settings, buffer_minutes: 30 };
    const busy = [{ startsAt: at('09:00'), endsAt: at('10:00') }];
    const slots = computeSlots(DAY, withBuffer, busy, NOW);
    // 08:00-09:00 + 30m buffer touches 09:00-10:00; 10:00 slot's window touches it too? No: it starts at 10:00 == busy end (half-open ok).
    expect(slots.map((s) => s.available)).toEqual([false, false, true]);
  });

  it('hides slots that already started', () => {
    const slots = computeSlots(DAY, settings, [], at('08:30'));
    expect(slots.map((s) => s.available)).toEqual([false, true, true]);
  });
});
