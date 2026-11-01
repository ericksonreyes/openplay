import { Inject, Injectable, Logger } from '@nestjs/common';
import { importSPKI, jwtVerify, JWTPayload } from 'jose';
import { APP_ENV } from '../../config/config.module';
import { AppEnv } from '../../config/env';
import { RequestActor } from './actor';

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  /** Returns the verified actor, or null when the token cannot be trusted. */
  async verify(token: string): Promise<RequestActor | null> {
    try {
      let payload: JWTPayload;
      if (this.env.jwtMode === 'rs256') {
        const key = await importSPKI(this.env.jwtPublicKey!, 'RS256');
        payload = (
          await jwtVerify(token, key, {
            issuer: this.env.jwtIssuer,
            audience: this.env.jwtAudience,
          })
        ).payload;
      } else if (this.env.jwtMode === 'hs256') {
        payload = (
          await jwtVerify(token, new TextEncoder().encode(this.env.jwtSecret!), {
            issuer: this.env.jwtIssuer,
            audience: this.env.jwtAudience,
          })
        ).payload;
      } else {
        this.logger.warn('JWT verification attempted with no signing mode configured');
        return null;
      }
      return this.actorFrom(payload);
    } catch (err) {
      this.logger.warn(`JWT rejected: ${(err as Error).message}`);
      return null;
    }
  }

  private actorFrom(payload: JWTPayload): RequestActor {
    const roles = asStringArray(payload.roles);
    return {
      userId: payload.sub,
      tenantId: typeof payload.tenant_id === 'string' ? payload.tenant_id : undefined,
      roles,
      permissions: asStringArray(payload.permissions),
      venueIds: asStringArray(payload.venue_ids),
      isPlatform: roles.includes('platform.admin'),
      isSystem: false,
      isPublic: false,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
