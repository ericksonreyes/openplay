import { isUuid, isUuidv7, newId } from './uuid';
import { SqidCodec } from './sqid';
import { ParseSqidPipe, ParseUuidPipe } from './parse-id.pipes';
import { NotFoundException } from '@nestjs/common';

describe('UUIDv7 helpers', () => {
  it('generates valid UUIDv7 identifiers', () => {
    const id = newId();
    expect(isUuid(id)).toBe(true);
    expect(isUuidv7(id)).toBe(true);
  });
});

describe('SqidCodec', () => {
  const codec = new SqidCodec();

  it('round-trips a bigint through a scope', () => {
    const sqid = codec.encode('invoice', 504n);
    expect(sqid.length).toBeGreaterThanOrEqual(6);
    expect(codec.decode('invoice', sqid)).toBe(504n);
  });

  it('returns null for undecodable input', () => {
    expect(codec.decode('invoice', '!!!not-a-sqid!!!')).toBeNull();
  });
});

describe('ParseUuidPipe', () => {
  it('passes a valid UUID through', () => {
    const id = newId();
    expect(new ParseUuidPipe().transform(id)).toBe(id);
  });

  it('rejects a malformed UUID with 404', () => {
    expect(() => new ParseUuidPipe().transform('not-a-uuid')).toThrow(NotFoundException);
  });
});

describe('ParseSqidPipe', () => {
  it('decodes a valid SQID to bigint', () => {
    const codec = new SqidCodec();
    const sqid = codec.encode('invoice', 42n);
    expect(ParseSqidPipe('invoice').transform(sqid)).toBe(42n);
  });

  it('rejects an undecodable SQID with 404', () => {
    expect(() => ParseSqidPipe('invoice').transform('%%%')).toThrow(NotFoundException);
  });
});
