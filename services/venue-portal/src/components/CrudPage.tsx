import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, attr, newIdempotencyKey, rawAttr, type Resource } from '../lib/api';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
} from './ui';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'datetime-local';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  /** Object-valued attribute: render the textarea as pretty-printed JSON and
   *  parse it back on submit. Pair with type 'textarea'. */
  json?: boolean;
  /** Prefilled value when the record has none (platform defaults). */
  defaultValue?: string;
  /** Attribute is a list; the control edits one element (hydrate raw[0], write [v]). */
  listify?: boolean;
  /** Attribute is stored in cents; the control edits in major units (e.g. pesos). */
  toCents?: boolean;
}

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

interface CrudPageProps {
  title: string;
  /** One-line purpose statement shown under the page title (UX §8). */
  description?: string;
  path: string;
  type: string;
  columns: ColumnDef[];
  fields?: FieldDef[];
  /** Extra query params for the list call. */
  params?: Record<string, string | undefined>;
  rowActions?: (r: Resource, reload: () => void) => RowAction[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean | { attr: string; equals: string | boolean | Array<string | boolean> };
  /** Link target for the first column's value (e.g. r => `/prices/${r.id}`). */
  detailPath?: (r: Resource) => string;
  idempotentCreate?: boolean;
  toolbar?: ReactNode;
  emptyMessage?: string;
}

export function buildAttrs(fields: FieldDef[], values: Record<string, string | boolean>) {
  const attrs: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    // Dot paths write into a nested object attribute: 'address.city' → attrs.address.city
    const dot = f.name.indexOf('.');
    const put = (val: unknown) => {
      if (dot === -1) {
        attrs[f.name] = val;
      } else {
        const [root, key] = [f.name.slice(0, dot), f.name.slice(dot + 1)];
        attrs[root] = { ...(attrs[root] as Record<string, unknown> | undefined), [key]: val };
      }
    };
    if (f.type === 'checkbox') {
      put(Boolean(v));
    } else if (f.type === 'number') {
      if (v !== '' && v !== undefined) put(Number(v));
    } else if (f.json) {
      if (typeof v === 'string' && v.trim() !== '') put(JSON.parse(v));
    } else if (typeof v === 'string' && v.trim() !== '') {
      if (f.listify) put([v.trim()]);
      else if (f.toCents) put(Math.round(Number(v) * 100));
      else if (f.type === 'datetime-local') put(new Date(v).toISOString());
      else put(v.trim());
    }
  }
  return attrs;
}

/** ISO timestamp → datetime-local input value (browser-local). */
function toLocalInput(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Read a (possibly dotted) attribute path, e.g. 'address.city'. */
function attrPath(r: Resource, name: string): unknown {
  let cur: unknown = r.attributes;
  for (const part of name.split('.')) {
    cur = (cur as Record<string, unknown> | null | undefined)?.[part];
  }
  return cur;
}

export function validateFields(fields: FieldDef[], values: Record<string, string | boolean>): string[] {
  const errors: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.name];
    if (f.type === 'checkbox') continue;
    if (v === undefined || String(v).trim() === '') errors.push(`${f.label} is required.`);
  }
  return errors;
}

export function ResourceForm({
  fields,
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  fields: FieldDef[];
  initial?: Resource | null;
  submitLabel: string;
  busy: boolean;
  onSubmit: (attrs: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const v: Record<string, string | boolean> = {};
    for (const f of fields) {
      let raw = initial ? attrPath(initial, f.name) : undefined;
      if (f.listify && Array.isArray(raw)) raw = raw[0];
      if (f.type === 'checkbox') v[f.name] = Boolean(raw);
      else if (f.json && raw && typeof raw === 'object') v[f.name] = JSON.stringify(raw, null, 2);
      else if (f.type === 'datetime-local') v[f.name] = toLocalInput(raw);
      else if (f.toCents) v[f.name] = raw === undefined || raw === null ? f.defaultValue ?? '' : (Number(raw) / 100).toString();
      else v[f.name] = raw === undefined || raw === null ? f.defaultValue ?? '' : String(raw);
    }
    return v;
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handle(e: FormEvent) {
    e.preventDefault();
    const errs = validateFields(fields, values);
    setErrors(errs);
    if (errs.length) return;
    setSubmitError(null);
    try {
      await onSubmit(buildAttrs(fields, values));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4" noValidate>
      {fields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </span>
          {f.type === 'textarea' ? (
            <textarea
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
              placeholder={f.placeholder}
            />
          ) : f.type === 'select' ? (
            <select
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'checkbox' ? (
            <input
              type="checkbox"
              checked={Boolean(values[f.name])}
              onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
          ) : (
            <input
              type={f.type ?? 'text'}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder={f.placeholder}
            />
          )}
          {f.help && <span className="mt-1 block text-xs text-slate-500">{f.help}</span>}
        </label>
      ))}
      {errors.length > 0 && (
        <ul role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {submitError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

const DATE_KEY_CANDIDATES = [
  'starts_at', 'date', 'opened_at', 'registered_at', 'recorded_at',
  'created_at', 'due_at', 'resolved_at', 'ends_at',
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
   *  (e.g. a page-level document picker). */
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

export function CrudPage({
  title,
  description,
  path,
  type,
  columns,
  fields = [],
  params,
  rowActions,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  detailPath,
  idempotentCreate = false,
  toolbar,
  emptyMessage = 'Nothing here yet.',
}: CrudPageProps) {
  const [rows, setRows] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ r: Resource; a: RowAction } | null>(null);
  const [serverCtl, setServerCtl] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.list(path, { ...params, ...serverCtl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
      setRows([]);
    }
  }, [path, JSON.stringify(params), JSON.stringify(serverCtl)]);

  useEffect(() => {
    load();
  }, [load]);

  const cols = useMemo(
    () =>
      detailPath && columns.length > 0
        ? [
            {
              ...columns[0],
              render: (r: Resource) => (
                <Link to={detailPath(r)} className="text-indigo-600 hover:underline">
                  {columns[0].render ? columns[0].render(r) : attr(r, columns[0].key) || '—'}
                </Link>
              ),
            },
            ...columns.slice(1),
          ]
        : columns,
    [columns, detailPath],
  );

  async function save(attrs: Record<string, unknown>) {
    setBusy(true);
    try {
      if (editing === 'new') {
        await api.create(path, type, attrs, idempotentCreate ? newIdempotencyKey() : undefined);
      } else if (editing) {
        await api.update(`${path}/${editing.id}`, type, attrs);
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.remove(`${path}/${deleting.id}`);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  async function runAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await pendingAction.a.run(pendingAction.r);
      setPendingAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      setPendingAction(null);
    } finally {
      setBusy(false);
    }
  }

  const actions = (r: Resource) => {
    const extra = rowActions?.(r, load) ?? [];
    return (
      <div className="flex justify-end gap-3">
        {extra
          .filter((a) => {
            if (!a.when) return true;
            const v = rawAttr(r, a.when.attr);
            const allowed = Array.isArray(a.when.equals) ? a.when.equals : [a.when.equals];
            return (allowed as unknown[]).includes(v);
          })
          .map((a) => (
            <button
              key={a.label}
              onClick={() =>
                a.confirm ? setPendingAction({ r, a }) : void a.run(r).then(load).catch((e) => setError(String(e)))
              }
              className={`rounded border px-2 py-1 text-xs font-medium ${
                a.danger
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              {a.tableLabel ?? a.label}
            </button>
          ))}
        {canEdit && fields.length > 0 && (
          <button
            onClick={() => setEditing(r)}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Edit
          </button>
        )}
        {(canDelete === true ||
          (typeof canDelete === 'object' &&
            (Array.isArray(canDelete.equals)
              ? canDelete.equals.includes(rawAttr(r, canDelete.attr) as string | boolean)
              : rawAttr(r, canDelete.attr) === canDelete.equals))) && (
          <button
            onClick={() => setDeleting(r)}
            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    );
  };

  // Singular entity name for dialog titles: "Facilities" → "Facility".
  const singularTitle = title.replace(/ies$/i, 'y').replace(/s$/i, '');

  // Human-readable label for the row being deleted — identity attrs
  // first, then fall back to the first column's rendered value.
  const deletingLabel = deleting
    ? attr(deleting, 'name') ||
        attr(deleting, 'title') ||
        attr(deleting, 'reference_no') ||
        attr(deleting, 'reason') ||
        attr(deleting, 'display_name') ||
        (cols[0] ? rowText(deleting, cols[0]) : '') ||
        null
    : null;

  return (
    <div>
      <PageHeader title={title} description={description}>
        {canCreate && fields.length > 0 && (
          <button
            onClick={() => setEditing('new')}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New
          </button>
        )}
      </PageHeader>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={load} /></div>}
      {rows === null ? (
        <Spinner />
      ) : (
        <DataTable
          toolbar={toolbar}
          columns={cols}
          rows={rows}
          emptyMessage={emptyMessage}
          actions={actions}
          server={(c) =>
            setServerCtl({
              sort: c.sort,
              'filter[from]': c.from,
              'filter[to]': c.to,
              'filter[q]': c.q,
            })
          }
        />
      )}

      {editing && (
        <Modal title={editing === 'new' ? `New ${title.replace(/s$/, '')}` : 'Edit'} onClose={() => setEditing(null)}>
          <ResourceForm
            fields={fields}
            initial={editing === 'new' ? null : editing}
            submitLabel={editing === 'new' ? 'Create' : 'Save'}
            busy={busy}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${singularTitle}`}
          message={`${deletingLabel ? `Delete "${deletingLabel}"? ` : 'This record will be permanently deleted. '}This cannot be undone.`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.a.label}
          message={pendingAction.a.confirm ?? 'Continue?'}
          confirmLabel={pendingAction.a.label}
          danger={pendingAction.a.danger}
          busy={busy}
          onConfirm={runAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
