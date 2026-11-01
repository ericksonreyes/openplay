import {
  firstErrorDetail,
  unwrapCollection,
  unwrapResource,
} from '../lib/jsonapi';

describe('unwrapResource', () => {
  it('merges id into attributes', () => {
    const doc = {
      data: {
        type: 'business',
        id: 'acme',
        attributes: { code: 'acme', name: 'Acme Sports Club' },
      },
    };
    expect(unwrapResource(doc)).toEqual({
      id: 'acme',
      code: 'acme',
      name: 'Acme Sports Club',
    });
  });

  it('returns null for missing data', () => {
    expect(unwrapResource(null)).toBeNull();
    expect(unwrapResource({})).toBeNull();
    expect(unwrapResource({ data: null })).toBeNull();
  });
});

describe('unwrapCollection', () => {
  it('unwraps each member of data', () => {
    const doc = {
      data: [
        { type: 'business', id: 'a', attributes: { name: 'A' } },
        { type: 'business', id: 'b', attributes: { name: 'B' } },
      ],
    };
    expect(unwrapCollection(doc)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('returns an empty array when data is not an array', () => {
    expect(unwrapCollection(null)).toEqual([]);
    expect(unwrapCollection({})).toEqual([]);
  });
});

describe('firstErrorDetail', () => {
  it('reads the first error detail', () => {
    const doc = { errors: [{ code: 'NOT_FOUND', detail: 'Business not found' }] };
    expect(firstErrorDetail(doc)).toBe('Business not found');
  });

  it('falls back to title/code and null', () => {
    expect(firstErrorDetail({ errors: [{ code: 'INTERNAL', title: 'Internal' }] })).toBe('Internal');
    expect(firstErrorDetail({ errors: [{ code: 'INTERNAL' }] })).toBe('INTERNAL');
    expect(firstErrorDetail(null)).toBeNull();
    expect(firstErrorDetail({ errors: [] })).toBeNull();
  });
});
