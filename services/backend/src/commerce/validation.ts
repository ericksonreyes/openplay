import { BadRequestException } from '@nestjs/common';
import {
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  requireEnum,
  requireString,
} from '../venue-catalog/validation';

/** Shared request-body validation for commerce. Manual checks only. */

export const PAYMENT_METHODS = ['gcash', 'maya', 'direct_transfer', 'pay_at_venue'] as const;
export const PAYMENT_PURPOSES = ['reservation', 'event', 'membership', 'rental'] as const;
export const PLAN_STATUSES = ['draft', 'active', 'archived'] as const;
export const BILLING_TYPES = ['one_time', 'recurring'] as const;
export const TERM_END_RULES = ['term', 'fixed_expiration', 'earliest'] as const;
export const DISPUTE_CATEGORIES = [
  'payment',
  'no_show',
  'cancellation',
  'equipment',
  'service',
] as const;
export const DISPUTE_SUBJECT_TYPES = ['reservation', 'event', 'rental', 'payment'] as const;
export const EQUIPMENT_STATUSES = ['draft', 'active', 'archived'] as const;

export {
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  requireEnum,
  requireString,
};

export function optionalInstant(
  body: Record<string, unknown>,
  field: string,
): Date | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  return new Date(value);
}

export function requireInstant(body: Record<string, unknown>, field: string): Date {
  const value = optionalInstant(body, field);
  if (!value) throw new BadRequestException(`${field} is required`);
  return value;
}

/** Idempotency-Key header: opaque, bounded, optional. */
export function idempotencyKeyFrom(headerValue: unknown): string | undefined {
  if (headerValue === undefined || headerValue === null) return undefined;
  if (typeof headerValue !== 'string' || headerValue.length === 0 || headerValue.length > 200) {
    throw new BadRequestException('Idempotency-Key must be a string of at most 200 characters');
  }
  return headerValue;
}
