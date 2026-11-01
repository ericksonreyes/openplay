import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/**
 * Single-use credential helpers (recovery + invite tokens).
 * The raw token is delivered out-of-band (notification row); only its
 * SHA-256 hash is stored — hashing is a pure function so specs can assert
 * it without a database.
 */

export const RECOVERY_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
export const MIN_PASSWORD_LENGTH = 8;

export const hashCredential = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

/** Returns the raw token (delivered) and its persisted hash. */
export const generateCredential = (): { token: string; tokenHash: string } => {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashCredential(token) };
};

export interface AuthTokenRow {
  id: string;
  user_id: string;
  kind: string;
  expires_at: Date;
  consumed_at: Date | null;
}

/** A token can be consumed exactly once, before expiry. */
export const isTokenUsable = (
  row: Pick<AuthTokenRow, 'expires_at' | 'consumed_at'>,
  now: Date,
): boolean => row.consumed_at === null && row.expires_at.getTime() > now.getTime();

export const requirePassword = (value: unknown): string => {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return value;
};
