import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Existence-checking failures must not reveal whether a record exists:
 * "found in another tenant's scope" and "never existed" both produce this.
 */
export class RecordNotFoundException extends HttpException {
  constructor() {
    super('Not found', HttpStatus.NOT_FOUND);
  }
}
