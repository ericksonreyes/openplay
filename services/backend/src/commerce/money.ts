import { BadRequestException } from '@nestjs/common';

/**
 * Money representation — DECISION: all amounts are integer minor units
 * ("centavos" for PHP: 100 centavos = 1 peso) stored in `amount_cents`
 * / `price_cents` columns. No floats, no decimal serialization anywhere
 * in the commerce module; arithmetic is plain integer math and always
 * exact. JSON:API attributes expose the same integer under
 * `amount_cents`/`price_cents` plus a `currency` ISO-4217 code.
 */

export const DEFAULT_CURRENCY = 'PHP';

/** Validates a minor-unit amount from a request body or computation. */
export function requireAmountCents(
  body: Record<string, unknown>,
  field = 'amount_cents',
  { allowZero = false }: { allowZero?: boolean } = {},
): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BadRequestException(`${field} must be an integer number of minor units`);
  }
  if (value < 0 || (!allowZero && value === 0)) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new BadRequestException(`${field} is out of range`);
  }
  return value;
}

/** Integer line-item math — the only money arithmetic allowed. */
export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((total, a) => {
    if (!Number.isInteger(a)) {
      throw new BadRequestException('amounts must be integers');
    }
    return total + a;
  }, 0);
}

/** Remaining refundable balance: captured minus already-succeeded refunds. */
export function refundableBalance(capturedCents: number, refundedCents: number): number {
  return Math.max(0, capturedCents - refundedCents);
}

/** Percentage-based fee in minor units, rounded half-up to an integer. */
export function percentageOf(amountCents: number, basisPoints: number): number {
  if (!Number.isInteger(amountCents) || !Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new BadRequestException('invalid fee inputs');
  }
  return Math.round((amountCents * basisPoints) / 10_000);
}
