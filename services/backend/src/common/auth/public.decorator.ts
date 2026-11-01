import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'openplay:isPublic';
/** Marks a route as reachable without a JWT. Default is deny. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
