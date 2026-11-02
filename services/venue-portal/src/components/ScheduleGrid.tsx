import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { attr, type Resource } from '../lib/api';
import { displayHour, formatSlot } from '../lib/format';

export const DAY_START = 6; // 6am
export const DAY_END = 23; // 11pm
const HOUR_PX = 56;

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - dow);
  return isoDay(d);
}
/** Hour (float, 0–24) of an ISO timestamp in the venue's display zone. */
export const hourOf = displayHour;

export function blockTone(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'approved':
      return 'bg-indigo-100 border-indigo-300 text-indigo-800';
    case 'pending_approval':
    case 'hold':
      return 'bg-amber-100 border-amber-300 text-amber-800';
    case 'cancelled':
    case 'declined':
      return 'bg-slate-100 border-slate-300 text-slate-500 line-through';
    default:
      return 'bg-slate-100 border-slate-300 text-slate-700';
  }
}

/** Greedy interval partitioning — overlapping bookings get separate lanes. */
function laneCount(items: { start: number; end: number }[]): number {
  const ends: number[] = [];
  for (const b of [...items].sort((a, b) => a.start - b.start)) {
    const free = ends.findIndex((e) => e <= b.start);
    if (free === -1) ends.push(b.end);
    else ends[free] = b.end;
  }
  return Math.max(1, ends.length);
}
function laneOf(b: { start: number; end: number }, all: { start: number; end: number }[]): number {
  const ends: number[] = [];
  for (const x of [...all].sort((a, c) => a.start - c.start)) {
    const free = ends.findIndex((e) => e <= x.start);
    const lane = free === -1 ? ends.length : free;
    ends[lane] = x.end;
    if (x === b) return lane;
  }
  return 0;
}

/** Shared time-grid: columns × venue hours, booking blocks positioned by time. */
export function TimeGrid({
  columns,
  rows,
  colOf,
  labelOf,
  onEmptySlot,
}: {
  columns: { key: string; label: ReactNode }[];
  rows: Resource[];
  colOf: (r: Resource) => string;
  /** Block title text; defaults to customer/title/activity attrs. */
  labelOf?: (r: Resource) => string;
  /** Double-click a vacant hour cell — e.g. open the booking flow. */
  onEmptySlot?: (columnKey: string, hour: number) => void;
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const who = labelOf ?? ((r: Resource) => attr(r, 'customer_name') || attr(r, 'title') || attr(r, 'activity_name') || '—');
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(9rem, 1fr))` }}>
        <div className="border-b border-slate-200 bg-slate-50" />
        {columns.map((c) => (
          <div key={c.key} className="border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 first:border-l-0">
            {c.label}
          </div>
        ))}
        <div className="relative border-r border-slate-200">
          {hours.map((h) => (
            <div key={h} className="border-t border-slate-100 px-1.5 text-right text-[11px] text-slate-400" style={{ height: HOUR_PX }}>
              {h % 12 || 12} {h < 12 ? 'AM' : 'PM'}
            </div>
          ))}
          <div style={{ height: HOUR_PX }} />
        </div>
        {columns.map((c) => (
          <div key={c.key} className="relative border-l border-slate-200 first:border-l-0">
            {hours.map((h) => (
              <div
                key={h}
                onDoubleClick={onEmptySlot ? () => onEmptySlot(c.key, h) : undefined}
                title={onEmptySlot ? 'Double-click to book this slot' : undefined}
                className={`border-t border-slate-100${onEmptySlot ? ' cursor-pointer hover:bg-indigo-50/40' : ''}`}
                style={{ height: HOUR_PX }}
              />
            ))}
            <div className="border-t border-slate-100" style={{ height: HOUR_PX }} />
            {(() => {
              const items = rows
                .filter((r) => colOf(r) === c.key && attr(r, 'starts_at'))
                .map((r) => ({
                  r,
                  start: hourOf(attr(r, 'starts_at')),
                  end: attr(r, 'ends_at') ? hourOf(attr(r, 'ends_at')) : hourOf(attr(r, 'starts_at')) + 1,
                }));
              const nLanes = laneCount(items);
              return items.map(({ r, start, end }) => {
                const lane = laneOf({ start, end }, items);
                const top = Math.max(0, (start - DAY_START) * HOUR_PX);
                const height = Math.max(18, (end - start) * HOUR_PX - 2);
                const widthPct = 100 / nLanes;
                return (
                  <Link
                    key={r.id}
                    to={
                      r.type === 'reservation'
                        ? `/reservations/${r.id}`
                        : r.type === 'event'
                          ? `/events/${r.id}`
                          : '#'
                    }
                    title={`${formatSlot(attr(r, 'starts_at'), attr(r, 'ends_at'))} — ${who(r)} (${attr(r, 'status')})`}
                    className={`absolute overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight ${blockTone(attr(r, 'status'))}`}
                    style={{
                      top,
                      height,
                      left: `calc(${lane * widthPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <div className="font-medium">{who(r)}</div>
                    <div className="truncate opacity-75">{attr(r, 'resource_name')}</div>
                  </Link>
                );
              });
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
