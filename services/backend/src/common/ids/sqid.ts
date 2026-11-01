import { Injectable } from '@nestjs/common';
import Sqids from 'sqids';

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MIN_LENGTH = 6;

/**
 * bigint<->SQID codec. Each scope may override the alphabet via
 * SQID_ALPHABET_<SCOPE> (uppercased scope name) so IDs cannot be
 * correlated across record types; SQID_ALPHABET sets the fallback.
 */
@Injectable()
export class SqidCodec {
  private readonly codecs = new Map<string, Sqids>();

  private forScope(scope: string): Sqids {
    let codec = this.codecs.get(scope);
    if (!codec) {
      const envKey = `SQID_ALPHABET_${scope.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const alphabet =
        process.env[envKey] || process.env.SQID_ALPHABET || DEFAULT_ALPHABET;
      codec = new Sqids({ alphabet, minLength: MIN_LENGTH });
      this.codecs.set(scope, codec);
    }
    return codec;
  }

  /** bigint IDs must stay below Number.MAX_SAFE_INTEGER (sqids works on numbers). */
  encode(scope: string, id: bigint | number): string {
    const n = Number(id);
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new RangeError(`id out of SQID-encodable range: ${id}`);
    }
    return this.forScope(scope).encode([n]);
  }

  /** Returns null when the value is not a decodable SQID for this scope. */
  decode(scope: string, sqid: string): bigint | null {
    const numbers = this.forScope(scope).decode(sqid);
    if (numbers.length !== 1) {
      return null;
    }
    return BigInt(numbers[0]);
  }
}
