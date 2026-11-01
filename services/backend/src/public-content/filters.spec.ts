import {
  businessListWhere,
  dayRange,
  isListedEvent,
  isPublishedBusiness,
  isResolvableEvent,
  readFilter,
} from './filters';

describe('publication filters', () => {
  it('requires published AND active for a business to be listable', () => {
    expect(isPublishedBusiness({ status: 'active', published: true })).toBe(true);
    expect(isPublishedBusiness({ status: 'active', published: false })).toBe(false);
    expect(isPublishedBusiness({ status: 'awaiting_review', published: true })).toBe(false);
    expect(isPublishedBusiness({ status: 'suspended', published: true })).toBe(false);
  });

  it('builds a bounded directory where-clause with optional name search', () => {
    expect(businessListWhere()).toEqual({ published: true, status: 'active' });
    expect(businessListWhere('acme')).toEqual({
      published: true,
      status: 'active',
      name: { contains: 'acme', mode: 'insensitive' },
    });
  });

  it('lists only upcoming public events but resolves ended ones by id', () => {
    expect(isListedEvent({ status: 'published', visibility: 'public' })).toBe(true);
    expect(isListedEvent({ status: 'registration_open', visibility: 'public' })).toBe(true);
    expect(isListedEvent({ status: 'complete', visibility: 'public' })).toBe(false);
    expect(isListedEvent({ status: 'published', visibility: 'internal' })).toBe(false);
    expect(isListedEvent({ status: 'draft', visibility: 'public' })).toBe(false);

    expect(isResolvableEvent({ status: 'complete', visibility: 'public' })).toBe(true);
    expect(isResolvableEvent({ status: 'cancelled', visibility: 'public' })).toBe(true);
    expect(isResolvableEvent({ status: 'draft', visibility: 'public' })).toBe(false);
    expect(isResolvableEvent({ status: 'published', visibility: 'internal' })).toBe(false);
  });

  it('parses YYYY-MM-DD into a day range and rejects malformed dates', () => {
    const range = dayRange('2030-06-15');
    expect(range?.gte.toISOString()).toBe('2030-06-15T00:00:00.000Z');
    expect(range?.lt.toISOString()).toBe('2030-06-16T00:00:00.000Z');
    expect(dayRange('15-06-2030')).toBeNull();
    expect(dayRange('')).toBeNull();
  });

  it('reads filter[...] params in both nested and flat query shapes', () => {
    expect(readFilter({ filter: { name: 'acme' } }, 'name')).toBe('acme');
    expect(readFilter({ 'filter[tenant]': 'acme-sports' }, 'tenant')).toBe('acme-sports');
    expect(readFilter({ filter: {} }, 'name')).toBeUndefined();
    expect(readFilter({}, 'name')).toBeUndefined();
    expect(readFilter({ filter: { date: '  ' } }, 'date')).toBeUndefined();
  });
});
