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

/**
 * Domain errors carry a stable, specific code (CHECKIN_WINDOW_CLOSED, not
 * CONFLICT) so frontends can map friendly copy; meta adds machine-usable
 * context (e.g. window_opens_at).
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    detail: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super({ message: detail, code, meta }, status);
  }
}
