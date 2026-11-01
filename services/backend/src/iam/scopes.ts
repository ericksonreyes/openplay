import { BadRequestException } from '@nestjs/common';

/**
 * Scope model (security/IDENTITY_AND_ACCESS.MD):
 * - platform scope: players + Platform Administrators — email is the
 *   identifier; globally unique per scope.
 * - tenant scope: owners/managers/staff — resolved by tenant code +
 *   username (email optional).
 */
export type UserScope = 'platform' | 'tenant';

export const USER_SCOPES: readonly UserScope[] = ['platform', 'tenant'];

/** Roles creatable through the staff-invite path — owners are provisioned, never invited. */
export const INVITABLE_ROLES = ['venue.manager', 'venue.staff'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Roles assignable to a tenant user via PATCH /staff/:id. */
export const ASSIGNABLE_STAFF_ROLES = ['business.owner', 'venue.manager', 'venue.staff'] as const;

export const requireScope = (value: unknown): UserScope => {
  if (value !== 'platform' && value !== 'tenant') {
    throw new BadRequestException('scope must be platform or tenant');
  }
  return value;
};

export const requireInvitableRole = (value: unknown): InvitableRole => {
  if (typeof value !== 'string' || !INVITABLE_ROLES.includes(value as InvitableRole)) {
    throw new BadRequestException(`role must be one of: ${INVITABLE_ROLES.join(', ')}`);
  }
  return value as InvitableRole;
};

export const requireAssignableStaffRole = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !ASSIGNABLE_STAFF_ROLES.includes(value as (typeof ASSIGNABLE_STAFF_ROLES)[number])
  ) {
    throw new BadRequestException(`role must be one of: ${ASSIGNABLE_STAFF_ROLES.join(', ')}`);
  }
  return value;
};

/**
 * Recovery identifier resolution: platform scope looks up by email;
 * tenant scope requires tenantCode + (username or email). Returns the
 * descriptor the recovery controller turns into a query, or null when the
 * request cannot resolve an account (still answered 202 — non-revealing).
 */
export const recoveryTarget = (input: {
  scope: UserScope;
  tenantCode?: string;
  identifier?: string;
}): { scope: UserScope; tenantCode?: string; email?: string; username?: string } | null => {
  const identifier = input.identifier?.trim();
  if (!identifier) {
    return null;
  }
  if (input.scope === 'platform') {
    return { scope: 'platform', email: identifier };
  }
  if (!input.tenantCode?.trim()) {
    return null;
  }
  const byEmail = identifier.includes('@');
  return {
    scope: 'tenant',
    tenantCode: input.tenantCode.trim(),
    ...(byEmail ? { email: identifier } : { username: identifier }),
  };
};
