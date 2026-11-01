import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'openplay:requiredPermissions';
/** Caller must carry every listed permission in its verified claims. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
