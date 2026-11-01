import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface BucketRule {
  prefix: string;
  limit: number;
  windowMs: number;
}

/**
 * In-memory fixed-window limiter (local-dev single process; a shared store
 * is the documented upgrade path for multi-instance deployments).
 * Public and auth endpoints get dedicated buckets per INTERNAL_SERVICE_SECURITY.
 */
const RULES: BucketRule[] = [
  { prefix: '/api/v1/auth/', limit: 10, windowMs: 60_000 },
  { prefix: '/api/v1/public/', limit: 120, windowMs: 60_000 },
];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const rule = RULES.find((r) => req.path.startsWith(r.prefix));
    if (!rule) {
      return true;
    }
    const key = `${rule.prefix}:${req.ip}`;
    const now = Date.now();
    let bucket = this.hits.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + rule.windowMs };
      this.hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > rule.limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
