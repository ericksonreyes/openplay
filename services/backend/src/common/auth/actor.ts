/** Verified caller identity — built only from JWT claims, never request input. */
export interface RequestActor {
  userId?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  venueIds: string[];
  isPlatform: boolean;
  isSystem: boolean;
  isPublic: boolean;
  jti?: string;
  /** seconds-since-epoch expiry from the token; used for blacklist TTL. */
  exp?: number;
}

export const publicActor = (): RequestActor => ({
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: false,
  isPublic: true,
});
