import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';

/**
 * Redis-backed JWT jti blacklist (API_SECURITY: revoked tokens are denied
 * until natural expiry). Fails open with a logged warning when Redis is
 * unavailable — that gap is observable in logs, per the documented fallback.
 */
@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis?: Redis;
  private warned = false;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    if (this.env.redisUrl) {
      this.redis = new Redis(this.env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.redis.connect().catch((err: Error) =>
        this.warnOnce(`redis connect failed: ${err.message}`),
      );
    } else {
      this.warnOnce('REDIS_URL unset — JWT blacklist disabled (expiry-only validation)');
    }
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.redis || ttlSeconds <= 0) {
      return;
    }
    try {
      await this.redis.set(`jwt:blacklist:${jti}`, '1', 'EX', Math.ceil(ttlSeconds));
    } catch (err) {
      this.warnOnce(`redis revoke failed: ${(err as Error).message}`);
    }
  }

  async isRevoked(jti?: string): Promise<boolean> {
    if (!this.redis || !jti) {
      return false;
    }
    try {
      return (await this.redis.exists(`jwt:blacklist:${jti}`)) === 1;
    } catch {
      this.warnOnce('redis blacklist check failed — treating token as valid');
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  private warnOnce(message: string): void {
    if (!this.warned) {
      this.logger.warn(message);
      this.warned = true;
    }
  }
}
