import { BadRequestException } from '@nestjs/common';
import {
  percentageOf,
  refundableBalance,
  requireAmountCents,
  sumAmounts,
} from './money';

describe('money', () => {
  it('accepts positive integer minor units', () => {
    expect(requireAmountCents({ amount_cents: 50000 })).toBe(50000);
  });

  it('rejects zero unless allowed, floats, and negatives', () => {
    expect(() => requireAmountCents({ amount_cents: 0 })).toThrow(BadRequestException);
    expect(requireAmountCents({ amount_cents: 0 }, 'amount_cents', { allowZero: true })).toBe(0);
    expect(() => requireAmountCents({ amount_cents: 12.5 })).toThrow(BadRequestException);
    expect(() => requireAmountCents({ amount_cents: -1 })).toThrow(BadRequestException);
    expect(() => requireAmountCents({ amount_cents: '100' })).toThrow(BadRequestException);
  });

  it('sums integer amounts exactly', () => {
    expect(sumAmounts([100, 250, 50])).toBe(400);
    expect(sumAmounts([])).toBe(0);
    expect(() => sumAmounts([1.5 as number])).toThrow(BadRequestException);
  });

  it('computes the refundable balance without going negative', () => {
    expect(refundableBalance(50000, 20000)).toBe(30000);
    expect(refundableBalance(50000, 50000)).toBe(0);
    expect(refundableBalance(50000, 60000)).toBe(0);
  });

  it('computes percentage fees in integer minor units', () => {
    expect(percentageOf(10000, 250)).toBe(250); // 2.5%
    expect(percentageOf(333, 500)).toBe(17); // 5% of 3.33, half-up
    expect(() => percentageOf(100, -1)).toThrow(BadRequestException);
  });
});
