import {
  ASSIGNABLE_STAFF_ROLES,
  INVITABLE_ROLES,
  recoveryTarget,
  requireAssignableStaffRole,
  requireInvitableRole,
  requireScope,
} from './scopes';

describe('scope resolution', () => {
  it('accepts only platform and tenant scopes', () => {
    expect(requireScope('platform')).toBe('platform');
    expect(requireScope('tenant')).toBe('tenant');
    expect(() => requireScope('global')).toThrow();
    expect(() => requireScope(undefined)).toThrow();
  });

  it('resolves platform recovery by email', () => {
    expect(recoveryTarget({ scope: 'platform', identifier: 'a@b.test' })).toEqual({
      scope: 'platform',
      email: 'a@b.test',
    });
  });

  it('resolves tenant recovery by tenant code + username or email', () => {
    expect(recoveryTarget({ scope: 'tenant', tenantCode: 'acme', identifier: 'sam' })).toEqual({
      scope: 'tenant',
      tenantCode: 'acme',
      username: 'sam',
    });
    expect(
      recoveryTarget({ scope: 'tenant', tenantCode: 'acme', identifier: 'sam@acme.test' }),
    ).toEqual({ scope: 'tenant', tenantCode: 'acme', email: 'sam@acme.test' });
  });

  it('cannot resolve without a tenant code or identifier', () => {
    expect(recoveryTarget({ scope: 'tenant', identifier: 'sam' })).toBeNull();
    expect(recoveryTarget({ scope: 'platform' })).toBeNull();
    expect(recoveryTarget({ scope: 'tenant', tenantCode: ' ', identifier: 'sam' })).toBeNull();
  });
});

describe('staff role allowlists', () => {
  it('invite accepts only venue.manager and venue.staff', () => {
    expect(INVITABLE_ROLES).not.toContain('business.owner');
    expect(INVITABLE_ROLES).not.toContain('platform.admin');
    expect(requireInvitableRole('venue.manager')).toBe('venue.manager');
    expect(requireInvitableRole('venue.staff')).toBe('venue.staff');
    expect(() => requireInvitableRole('business.owner')).toThrow();
    expect(() => requireInvitableRole('platform.admin')).toThrow();
    expect(() => requireInvitableRole('player')).toThrow();
  });

  it('patch allows the tenant roles but never platform or player roles', () => {
    for (const role of ASSIGNABLE_STAFF_ROLES) {
      expect(requireAssignableStaffRole(role)).toBe(role);
    }
    expect(() => requireAssignableStaffRole('platform.admin')).toThrow();
    expect(() => requireAssignableStaffRole('player')).toThrow();
    expect(() => requireAssignableStaffRole('venue.superuser')).toThrow();
  });
});
