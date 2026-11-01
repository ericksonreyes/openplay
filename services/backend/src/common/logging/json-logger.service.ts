import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const REDACTED_KEYS = /password|secret|token|private[_-]?key|authorization|credential|api[_-]?key/i;
const REDACTED = '[redacted]';

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACTED_KEYS.test(k) ? REDACTED : redact(v, depth + 1),
    ]),
  );
};

/** Structured one-line JSON logs; request_id joins entries to a request. */
@Injectable()
export class JsonLogger implements LoggerService {
  constructor(private readonly cls: ClsService) {}

  log(message: unknown, context?: string): void { this.write('log', message, context); }
  warn(message: unknown, context?: string): void { this.write('warn', message, context); }
  error(message: unknown, context?: string): void { this.write('error', message, context); }
  debug(message: unknown, context?: string): void { this.write('debug', message, context); }
  verbose(message: unknown, context?: string): void { this.write('verbose', message, context); }

  private write(level: LogLevel, message: unknown, context?: string): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      context,
      request_id: this.cls.get<string>('requestId'),
      ...(typeof message === 'object' && message !== null
        ? (redact(message) as object)
        : { message: String(message) }),
    };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}
