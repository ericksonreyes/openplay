import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/ids/uuid';

/** Pure request-body validation helpers. Manual checks — no class-validator. */

export const VENUE_STATUSES = ['draft', 'active', 'archived'] as const;
export const RECORD_STATUSES = ['draft', 'active', 'archived'] as const;
export const RULE_VISIBILITIES = ['public', 'internal'] as const;
export const RULE_STATUSES = ['draft', 'published', 'unpublished'] as const;
export const CLOSURE_KINDS = ['closure', 'internal_use'] as const;
export const CLOSURE_STATUSES = ['scheduled', 'cancelled'] as const;
export const WAIVER_DOC_STATUSES = ['draft', 'active', 'retired'] as const;
export const WAIVER_VERSION_STATUSES = ['draft', 'published', 'retired'] as const;
export const PRICE_UNITS = ['hour', 'booking', 'day'] as const;

export function requireString(body: Record<string, unknown>, field: string, maxLen = 500): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  if (value.length > maxLen) {
    throw new BadRequestException(`${field} is too long (max ${maxLen})`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, field: string, maxLen = 2000): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLen) {
    throw new BadRequestException(`${field} must be a string of at most ${maxLen} characters`);
  }
  return value;
}

export function optionalBoolean(body: Record<string, unknown>, field: string): boolean | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }
  return value;
}

export function optionalInt(body: Record<string, unknown>, field: string, min = 0): number | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new BadRequestException(`${field} must be an integer >= ${min}`);
  }
  return value;
}

export function requireEnum(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): string {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function optionalEnum(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireEnum(body, field, allowed);
}

export function optionalUuid(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return value;
}

export function optionalUuidList(body: Record<string, unknown>, field: string): string[] | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !isUuid(v))) {
    throw new BadRequestException(`${field} must be an array of UUIDs`);
  }
  return value as string[];
}

export function optionalJson(body: Record<string, unknown>, field: string): unknown {
  return body[field] === null ? undefined : body[field];
}

function parseInstant(value: unknown, field: string): Date {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  return date;
}

/** Closures require a well-ordered [starts_at, ends_at) window. */
export function requireTimeRange(body: Record<string, unknown>): { startsAt: Date; endsAt: Date } {
  const startsAt = parseInstant(body['starts_at'], 'starts_at');
  const endsAt = parseInstant(body['ends_at'], 'ends_at');
  if (endsAt <= startsAt) {
    throw new BadRequestException('ends_at must be after starts_at');
  }
  return { startsAt, endsAt };
}

/** Tenant resolution for writes: the actor's tenant, or an explicit one for platform actors. */
export function resolveTenantId(
  actor: { tenantId?: string; isPlatform: boolean },
  body: Record<string, unknown>,
): string {
  if (actor.tenantId) {
    return actor.tenantId;
  }
  const requested = body['tenant_id'];
  if (actor.isPlatform && typeof requested === 'string' && isUuid(requested)) {
    return requested;
  }
  throw new BadRequestException('tenant context is required');
}
