import { Inject, Injectable } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { APP_ENV } from '../config/config.module';
import { AppEnv } from '../config/env';

export interface IssuedToken {
  token: string;
  expiresIn: number;
}

/** Sole JWT signer: RS256 from JWT_PRIVATE_KEY, HS256 JWT_SECRET local fallback. */
@Injectable()
export class TokenService {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async issue(input: {
    sub: string;
    tenantId?: string;
    roles: string[];
    permissions: string[];
    venueIds?: string[];
  }): Promise<IssuedToken> {
    const builder = new SignJWT({
      roles: input.roles,
      permissions: input.permissions,
      ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
      ...(input.venueIds?.length ? { venue_ids: input.venueIds } : {}),
    })
      .setProtectedHeader({ alg: this.env.jwtMode === 'rs256' ? 'RS256' : 'HS256' })
      .setSubject(input.sub)
      .setIssuer(this.env.jwtIssuer)
      .setAudience(this.env.jwtAudience)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime(`${this.env.jwtTtlSeconds}s`);

    const token =
      this.env.jwtMode === 'rs256'
        ? await builder.sign(await importPKCS8(this.env.jwtPrivateKey!, 'RS256'))
        : await builder.sign(new TextEncoder().encode(this.env.jwtSecret!));
    return { token, expiresIn: this.env.jwtTtlSeconds };
  }
}
