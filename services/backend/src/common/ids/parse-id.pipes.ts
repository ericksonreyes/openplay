import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { isUuid } from './uuid';
import { SqidCodec } from './sqid';

/** External IDs that fail to decode are 404s, never 400s — do not leak internal state. */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUuid(value)) {
      throw new NotFoundException();
    }
    return value;
  }
}

export function ParseSqidPipe(scope: string) {
  const codec = new SqidCodec();
  class ScopedSqidPipe implements PipeTransform<string, bigint> {
    transform(value: string): bigint {
      const decoded = codec.decode(scope, value);
      if (decoded === null) {
        throw new NotFoundException();
      }
      return decoded;
    }
  }
  return new ScopedSqidPipe();
}
