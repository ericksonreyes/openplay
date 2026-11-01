import { BadRequestException } from '@nestjs/common';
import {
  validateTenantSubmission,
  validateTransition,
} from './tenants.validation';

const validBody = {
  code: 'acme-sports',
  name: 'Acme Sports Club',
  owner: { name: 'Ada Owner', email: 'ada@acme.test' },
};

describe('validateTenantSubmission', () => {
  it('accepts a valid submission and normalizes fields', () => {
    const out = validateTenantSubmission({
      ...validBody,
      code: ' acme-sports ',
      owner: { name: ' Ada ', email: 'ADA@ACME.TEST ' },
      message: ' hello ',
    });
    expect(out).toEqual({
      code: 'acme-sports',
      name: 'Acme Sports Club',
      ownerName: 'Ada',
      ownerEmail: 'ada@acme.test',
      message: 'hello',
    });
  });

  it.each([
    [{ ...validBody, code: 'UPPER' }],
    [{ ...validBody, code: 'ab' }],
    [{ ...validBody, code: '-leading' }],
    [{ ...validBody, code: 'trailing-' }],
    [{ ...validBody, code: 'bad code' }],
    [{ ...validBody, name: '' }],
    [{ ...validBody, owner: { name: '', email: 'a@b.co' } }],
    [{ ...validBody, owner: { name: 'X', email: 'not-an-email' } }],
    [null],
    [{}],
  ])('rejects invalid input %j with 400', (body) => {
    expect(() => validateTenantSubmission(body)).toThrow(BadRequestException);
  });
});

describe('validateTransition', () => {
  const opts = { reasonRequired: true, defaultPurpose: 'p' };

  it('requires a reason when configured', () => {
    expect(() => validateTransition({}, opts)).toThrow(BadRequestException);
    expect(() => validateTransition({ reason: '  ' }, opts)).toThrow(BadRequestException);
  });

  it('returns the reason and a default purpose', () => {
    expect(validateTransition({ reason: 'fraud' }, opts)).toEqual({
      reason: 'fraud',
      purpose: 'p',
    });
  });

  it('allows an explicit purpose and optional reason', () => {
    expect(
      validateTransition(
        { purpose: 'support ticket 42' },
        { reasonRequired: false, defaultPurpose: 'p' },
      ),
    ).toEqual({ reason: undefined, purpose: 'support ticket 42' });
  });

  it('rejects oversized reasons', () => {
    expect(() =>
      validateTransition({ reason: 'x'.repeat(501) }, opts),
    ).toThrow(BadRequestException);
  });
});
