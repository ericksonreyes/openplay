import { BadRequestException } from '@nestjs/common';
import {
  CLOSURE_KINDS,
  RULE_VISIBILITIES,
  optionalEnum,
  optionalInt,
  optionalUuid,
  optionalUuidList,
  requireEnum,
  requireString,
  requireTimeRange,
  resolveTenantId,
} from './validation';
import { newId } from '../common/ids/uuid';

describe('requireString', () => {
  it('returns a trimmed string', () => {
    expect(requireString({ name: '  Main Hall  ' }, 'name')).toBe('Main Hall');
  });

  it.each([{}, { name: '' }, { name: '   ' }, { name: 42 }, { name: null }])(
    'rejects %p',
    (body) => {
      expect(() => requireString(body, 'name')).toThrow(BadRequestException);
    },
  );
});

describe('requireEnum / optionalEnum', () => {
  it('accepts an allowed value', () => {
    expect(requireEnum({ kind: 'internal_use' }, 'kind', CLOSURE_KINDS)).toBe('internal_use');
    expect(optionalEnum({ visibility: 'public' }, 'visibility', RULE_VISIBILITIES)).toBe('public');
  });

  it('rejects a disallowed value', () => {
    expect(() => requireEnum({ kind: 'blockout' }, 'kind', CLOSURE_KINDS)).toThrow(BadRequestException);
  });

  it('optionalEnum passes through undefined', () => {
    expect(optionalEnum({}, 'kind', CLOSURE_KINDS)).toBeUndefined();
  });
});

describe('optionalInt', () => {
  it('accepts a non-negative integer', () => {
    expect(optionalInt({ amount_cents: 1500 }, 'amount_cents')).toBe(1500);
  });

  it.each([{ capacity: -1 }, { capacity: 1.5 }, { capacity: 'four' }])('rejects %p', (body) => {
    expect(() => optionalInt(body, 'capacity')).toThrow(BadRequestException);
  });
});

describe('optionalUuid / optionalUuidList', () => {
  it('accepts a valid UUID', () => {
    const id = newId();
    expect(optionalUuid({ venue_id: id }, 'venue_id')).toBe(id);
    expect(optionalUuidList({ resource_ids: [id] }, 'resource_ids')).toEqual([id]);
  });

  it('rejects malformed values', () => {
    expect(() => optionalUuid({ venue_id: 'nope' }, 'venue_id')).toThrow(BadRequestException);
    expect(() => optionalUuidList({ resource_ids: ['nope'] }, 'resource_ids')).toThrow(
      BadRequestException,
    );
  });
});

describe('requireTimeRange', () => {
  it('parses a well-ordered window', () => {
    const { startsAt, endsAt } = requireTimeRange({
      starts_at: '2030-01-01T09:00:00Z',
      ends_at: '2030-01-01T12:00:00Z',
    });
    expect(endsAt.getTime()).toBeGreaterThan(startsAt.getTime());
  });

  it('rejects ends_at before starts_at', () => {
    expect(() =>
      requireTimeRange({ starts_at: '2030-01-01T12:00:00Z', ends_at: '2030-01-01T09:00:00Z' }),
    ).toThrow(BadRequestException);
  });

  it('rejects non-timestamps', () => {
    expect(() => requireTimeRange({ starts_at: 'soon', ends_at: 'later' })).toThrow(
      BadRequestException,
    );
  });
});

describe('resolveTenantId', () => {
  const tenantId = newId();

  it('uses the actor tenant', () => {
    expect(
      resolveTenantId({ tenantId, isPlatform: false }, { tenant_id: newId() }),
    ).toBe(tenantId);
  });

  it('lets a platform actor pick a tenant explicitly', () => {
    const target = newId();
    expect(resolveTenantId({ isPlatform: true }, { tenant_id: target })).toBe(target);
  });

  it('rejects when no tenant can be resolved', () => {
    expect(() => resolveTenantId({ isPlatform: false }, {})).toThrow(BadRequestException);
    expect(() => resolveTenantId({ isPlatform: true }, { tenant_id: 'bogus' })).toThrow(
      BadRequestException,
    );
  });
});
