import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, attr, newIdempotencyKey, type Resource } from '../lib/api';
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
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (r: Resource) => ReactNode;
}

export interface RowAction {
  label: string;
  /** Which attribute value must equal (attr, equals) for the action to show. */
  when?: { attr: string; equals: string | string[] };
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
  canDelete?: boolean;
  idempotentCreate?: boolean;
  toolbar?: ReactNode;
  emptyMessage?: string;
}

export function buildAttrs(fields: FieldDef[], values: Record<string, string | boolean>) {
  const attrs: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') {
      attrs[f.name] = Boolean(v);
    } else if (f.type === 'number') {
      if (v !== '' && v !== undefined) attrs[f.name] = Number(v);
    } else if (typeof v === 'string' && v.trim() !== '') {
      attrs[f.name] = v.trim();
    }
  }
  return attrs;
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
      const raw = initial?.attributes?.[f.name];
      if (f.type === 'checkbox') v[f.name] = Boolean(raw);
      else v[f.name] = raw === undefined || raw === null ? '' : String(raw);
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
      <div className="flex justify-end gap-2">
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

export function DataTable({
  columns,
  rows,
  actions,
}: {
  columns: ColumnDef[];
  rows: Resource[];
  actions?: (r: Resource) => ReactNode;
}) {
  return (
    <div>
      {/* Mobile: each row renders as a stacked card with column labels. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
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
            {actions && <div className="mt-2 flex justify-end gap-2">{actions(r)}</div>}
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
                {c.label}
              </th>
            ))}
            {actions && <th className="px-4 py-2.5 text-right font-medium text-slate-600">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 text-slate-700">
                  {c.render ? c.render(r) : attr(r, c.key) || '—'}
                </td>
              ))}
              {actions && <td className="px-4 py-2.5 text-right">{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
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

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.list(path, params));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
      setRows([]);
    }
  }, [path, JSON.stringify(params)]);

  useEffect(() => {
    load();
  }, [load]);

  const cols = useMemo(() => columns, [columns]);

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
      <div className="flex justify-end gap-1.5">
        {extra
          .filter((a) => {
            if (!a.when) return true;
            const v = attr(r, a.when.attr);
            const allowed = Array.isArray(a.when.equals) ? a.when.equals : [a.when.equals];
            return allowed.includes(v);
          })
          .map((a) => (
            <button
              key={a.label}
              onClick={() =>
                a.confirm ? setPendingAction({ r, a }) : void a.run(r).then(load).catch((e) => setError(String(e)))
              }
              className={`rounded px-2 py-1 text-xs font-medium ${
                a.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {a.label}
            </button>
          ))}
        {canEdit && fields.length > 0 && (
          <button
            onClick={() => setEditing(r)}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => setDeleting(r)}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title={title} description={description}>
        {toolbar}
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
      ) : rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <DataTable columns={cols} rows={rows} actions={actions} />
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
          title="Delete record"
          message="This record will be permanently deleted. Continue?"
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
