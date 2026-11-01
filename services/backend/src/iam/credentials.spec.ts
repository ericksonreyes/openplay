import { createHash } from 'node:crypto';
import {
  generateCredential,
  hashCredential,
  INVITE_TOKEN_TTL_MS,
  isTokenUsable,
  RECOVERY_TOKEN_TTL_MS,
  requirePassword,
} from './credentials';

describe('credential tokens', () => {
  it('stores a SHA-256 hex digest, never the raw token', () => {
    const { token, tokenHash } = generateCredential();
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashCredential(token));
    expect(hashCredential(token)).toBe(
      createHash('sha256').update(token, 'utf8').digest('hex'),
    );
    expect(tokenHash).not.toContain(token);
  });

  it('generates unique tokens', () => {
    expect(generateCredential().token).not.toBe(generateCredential().token);
  });

  it('is usable only before expiry and exactly once', () => {
    const now = new Date();
    const row = { expires_at: new Date(now.getTime() + 1000), consumed_at: null };
    expect(isTokenUsable(row, now)).toBe(true);
    expect(isTokenUsable({ ...row, consumed_at: now }, now)).toBe(false); // consume-once
    expect(isTokenUsable({ ...row, expires_at: new Date(now.getTime() - 1) }, now)).toBe(false);
    expect(isTokenUsable({ ...row, expires_at: now }, now)).toBe(false); // boundary = expired
  });

  it('keeps recovery short-lived and invites longer', () => {
    expect(RECOVERY_TOKEN_TTL_MS).toBe(30 * 60 * 1000);
    expect(INVITE_TOKEN_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });

  it('enforces a minimum password length', () => {
    expect(() => requirePassword('short')).toThrow();
    expect(() => requirePassword(12345678)).toThrow();
    expect(requirePassword('long-enough-password')).toBe('long-enough-password');
  });
});
