import { canAccessOwnedRow, canViewAsPlayer, isStaffActor } from './scope';
import { newId } from '../common/ids/uuid';

const tenantId = newId();
const playerId = newId();
const row = { tenantId, playerId, guestContactId: null };

describe('scope decisions', () => {
  it('treats tenant and platform actors as staff', () => {
    expect(isStaffActor({ tenantId, isPlatform: false })).toBe(true);
    expect(isStaffActor({ isPlatform: true })).toBe(true);
    expect(isStaffActor({ isPlatform: false })).toBe(false);
    expect(isStaffActor({ isPlatform: false, isSystem: true })).toBe(true);
  });

  it('lets the owning player access their row', () => {
    expect(canAccessOwnedRow({ userId: playerId, isPlatform: false }, row)).toBe(true);
  });

  it('lets matching tenant staff access the row', () => {
    expect(canAccessOwnedRow({ tenantId, isPlatform: false }, row)).toBe(true);
  });

  it('denies other players and other tenants', () => {
    expect(canAccessOwnedRow({ userId: newId(), isPlatform: false }, row)).toBe(false);
    expect(canAccessOwnedRow({ tenantId: newId(), isPlatform: false }, row)).toBe(false);
  });

  it('platform actors bypass scope checks', () => {
    expect(canAccessOwnedRow({ isPlatform: true }, row)).toBe(true);
  });

  it('player view requires ownership', () => {
    expect(canViewAsPlayer({ userId: playerId, isPlatform: false }, row)).toBe(true);
    expect(canViewAsPlayer({ userId: newId(), isPlatform: false }, row)).toBe(false);
    // Tenant staff are not "players" even for their own tenant's rows.
    expect(canViewAsPlayer({ userId: playerId, tenantId, isPlatform: false }, row)).toBe(false);
  });
});
