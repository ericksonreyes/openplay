import { BadRequestException } from '@nestjs/common';

/**
 * Shared parsing for list-endpoint query params:
 *
 *   sort            = '<field>' | '-<field>'   (snake_case API key → Prisma field)
 *   filter[from]    = 'YYYY-MM-DD'             (inclusive, applied to dateField)
 *   filter[to]      = 'YYYY-MM-DD'             (inclusive, applied to dateField)
 *   filter[q]       = free-text                (case-insensitive contains over search fields)
 *
 * Unknown sort keys are ignored; malformed dates raise 400.
 */
export interface ListQueryOptions {
  /** Prisma field the from/to range applies to (e.g. 'startsAt', 'createdAt'). */
  dateField?: string;
  /** Allowed sort keys: API snake_case key → Prisma camelCase field. */
  sortable?: Record<string, string>;
  /** Prisma string fields searched by filter[q]. */
  search?: string[];
}

export interface ParsedListQuery {
  where: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Trimmed filter[q] value, when present. */
  q?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string, name: string): Date {
  if (!DATE_RE.test(value)) {
    throw new BadRequestException(`${name} must be YYYY-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${name} must be YYYY-MM-DD`);
  }
  return d;
}

export function parseListQuery(
  query: Record<string, string | undefined>,
  opts: ListQueryOptions = {},
): ParsedListQuery {
  const where: Record<string, unknown> = {};
  const out: ParsedListQuery = { where };

  const from = query['filter[from]'];
  const to = query['filter[to]'];
  if ((from || to) && opts.dateField) {
    const range: Record<string, Date> = {};
    if (from) range.gte = parseDay(from, 'filter[from]');
    if (to) range.lt = new Date(parseDay(to, 'filter[to]').getTime() + 86_400_000);
    where[opts.dateField] = range;
  }

  const q = query['filter[q]']?.trim();
  if (q) out.q = q;
  if (q && opts.search?.length) {
    where.OR = opts.search.map((f) => ({
      [f]: { contains: q, mode: 'insensitive' },
    }));
  }

  const sort = query['sort'];
  if (sort && opts.sortable) {
    const desc = sort.startsWith('-');
    const key = desc ? sort.slice(1) : sort;
    const field = opts.sortable[key];
    if (field) out.orderBy = { [field]: desc ? 'desc' : 'asc' };
  }

  return out;
}
