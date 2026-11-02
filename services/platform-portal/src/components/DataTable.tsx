import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { attr, type Resource } from '../lib/api';
import { StatusBadge } from './ui';

export interface ColumnDef {
  key: string;
  label: string;
  render?: (r: Resource) => ReactNode;
  /** Value used for sorting/searching; defaults to attr(r, key). */
  sortValue?: (r: Resource) => string;
  sortable?: boolean;
}

export interface RowAction {
  label: string;
  /** Verb-only caption for table row cells — detail views keep the full label. */
  tableLabel?: string;
  /** Which attribute value must equal (attr, equals) for the action to show. */
  when?: { attr: string; equals: string | boolean | Array<string | boolean> };
  confirm?: string;
  danger?: boolean;
  run: (r: Resource) => Promise<unknown>;
}

const DATE_KEY_CANDIDATES = [
  'starts_at', 'date', 'opened_at', 'registered_at', 'recorded_at',
  'occurred_at', 'created_at', 'due_at', 'resolved_at', 'ends_at',
];

function rowText(r: Resource, c: ColumnDef): string {
  return c.sortValue ? c.sortValue(r) : attr(r, c.key);
}

export function DataTable({
  columns,
  rows,
  actions,
  searchable = true,
  dateKey,
  pageSize = 15,
  server,
  emptyMessage,
  toolbar,
}: {
  columns: ColumnDef[];
  rows: Resource[];
  actions?: (r: Resource) => ReactNode;
  searchable?: boolean;
  /** Attribute holding an ISO timestamp for the From/To range filter.
   *  Auto-detected from column keys when omitted; pass '' to disable. */
  dateKey?: string;
  pageSize?: number;
  /** When set, control changes are also reported so the parent can refetch
   *  with server-side sort/filter[q]/filter[from]/filter[to] params.
   *  Client-side narrowing still applies on top. */
  server?: (controls: { sort?: string; from?: string; to?: string; q?: string }) => void;
  /** Message shown as the lone table row when the collection is empty. */
  emptyMessage?: string;
  /** Extra controls rendered at the start of the search/range toolbar row
   *  (e.g. a page-level status picker). */
  toolbar?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);

  // Debounced server-side control reporting (search keystrokes especially).
  useEffect(() => {
    if (!server) return;
    const t = setTimeout(
      () =>
        server({
          sort: sort ? `${sort.dir === -1 ? '-' : ''}${sort.key}` : undefined,
          from: from || undefined,
          to: to || undefined,
          q: query.trim() || undefined,
        }),
      500,
    );
    return () => clearTimeout(t);
  }, [server, query, from, to, sort]);

  const resolvedDateKey =
    dateKey === ''
      ? undefined
      : dateKey ??
        columns.find((c) => DATE_KEY_CANDIDATES.includes(c.key))?.key;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter(
        (r) =>
          columns.some((c) => rowText(r, c).toLowerCase().includes(q)) ||
          Object.values(r.attributes ?? {}).some(
            (v) =>
              (typeof v === 'string' || typeof v === 'number') &&
              String(v).toLowerCase().includes(q),
          ),
      );
    }
    if (resolvedDateKey && (from || to)) {
      out = out.filter((r) => {
        const d = attr(r, resolvedDateKey).slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) =>
          rowText(a, col).localeCompare(rowText(b, col), undefined, {
            numeric: true,
            sensitivity: 'base',
          }) * sort.dir,
        );
      }
    }
    return out;
  }, [rows, columns, query, from, to, sort, resolvedDateKey]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) =>
      s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null,
    );
  };

  const inputCls =
    'rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';

  return (
    <div>
      {(searchable || resolvedDateKey || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {toolbar}
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              aria-label="Search rows"
              className={`${inputCls} w-56`}
            />
          )}
          {resolvedDateKey && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                />
              </label>
            </>
          )}
        </div>
      )}
      {/* Mobile: each row renders as a stacked card with column labels. */}
      <ul className="space-y-3 md:hidden">
        {visible.length === 0 && (
          <li className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {rows.length === 0 ? (emptyMessage ?? 'No records.') : 'No matching rows.'}
          </li>
        )}
        {visible.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <dl className="divide-y divide-slate-100">
              {columns.map((c) => (
                <div key={c.key} className="flex justify-between gap-3 py-1.5 text-sm">
                  <dt className="shrink-0 text-slate-500">{c.label}</dt>
                  <dd className="text-right text-slate-800">
                    {c.render ? c.render(r) : attr(r, c.key) || '—'}
                  </dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-2 flex justify-end gap-3">{actions(r)}</div>}
          </li>
        ))}
      </ul>
      {/* Desktop: full table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2.5 text-left font-medium text-slate-600">
                {c.sortable === false ? (
                  c.label
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 font-medium hover:text-slate-900"
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-xs text-slate-400">
                      {sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                )}
              </th>
            ))}
            {actions && <th className="px-4 py-2.5 text-right font-medium text-slate-600">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 text-slate-700">
                  {c.render ? c.render(r) : attr(r, c.key) || '—'}
                </td>
              ))}
              {actions && <td className="px-4 py-2.5 text-right">{actions(r)}</td>}
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-4 py-8 text-center text-slate-500"
              >
                {rows.length === 0 ? (emptyMessage ?? 'No records.') : 'No matching rows.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {filtered.length === 0
            ? rows.length === 0
              ? 'No records found'
              : 'No matching rows'
            : `${filtered.length} row${filtered.length === 1 ? '' : 's'}`}
          {filtered.length !== rows.length && filtered.length > 0 && ` (of ${rows.length})`}
        </span>
        {pages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              type="button"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              ‹ Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === current ? 'page' : undefined}
                className={`rounded border px-3 py-1.5 text-sm ${
                  p === current
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next ›
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export function statusColumn(key = 'status'): ColumnDef {
  return { key, label: 'Status', render: (r) => <StatusBadge status={attr(r, key)} /> };
}
