import { useEffect, useState } from 'react';
import { apiFetch, ApiError, attr, type Resource } from '../lib/api';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useToast } from '../components/toast';

const columns: ColumnDef[] = [
  { key: 'key', label: 'Key', render: (r) => <code className="text-sm">{r.id}</code>, sortValue: (r) => r.id },
  {
    key: 'value',
    label: 'Value',
    sortable: false,
    render: (r) => <code className="text-xs">{JSON.stringify(r.attributes.value ?? {})}</code>,
  },
  {
    key: 'updated_at',
    label: 'Updated',
    render: (r) =>
      attr(r, 'updated_at')
        ? new Date(attr(r, 'updated_at')).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '—',
  },
];

/** Platform settings are key→JSON rows (platform_settings table); each row
 *  PATCHes its own key. Keys are free-form — new ones via "New setting". */
export function SettingsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    apiFetch<Resource[]>('/platform/settings')
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const openEdit = (r?: Resource) =>
    setEditing({
      key: r?.id ?? '',
      value: r ? JSON.stringify(r.attributes.value ?? {}, null, 2) : '{}',
    });

  const save = async () => {
    if (!editing) return;
    const key = editing.key.trim();
    if (!key) {
      setFormError('Key is required.');
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(editing.value || '{}');
    } catch {
      setFormError('Value must be valid JSON.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch(`/platform/settings/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        type: 'platform_setting',
        attributes: { value },
      });
      setEditing(null);
      notify(`Setting "${key}" saved.`, 'success');
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Save failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Platform settings"
        description="Key→value platform configuration. Each change is audited."
      >
        <button
          onClick={() => openEdit()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New setting
        </button>
      </PageHeader>
      {error && <ErrorState message={error} onRetry={() => setError(null)} actionLabel="Dismiss" />}
      {rows === null ? (
        <Spinner />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          searchable={false}
          dateKey=""
          emptyMessage="No settings yet — create the first key."
          actions={(r) => (
            <button
              onClick={() => openEdit(r)}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Edit
            </button>
          )}
        />
      )}
      {editing && (
        <Modal title={editing.key ? `Setting "${editing.key}"` : 'New setting'} onClose={() => !busy && setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="setting-key" className="block text-sm font-medium text-slate-700">
                Key
              </label>
              <input
                id="setting-key"
                type="text"
                maxLength={100}
                value={editing.key}
                disabled={busy}
                onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label htmlFor="setting-value" className="block text-sm font-medium text-slate-700">
                Value (JSON)
              </label>
              <textarea
                id="setting-value"
                rows={4}
                value={editing.value}
                disabled={busy}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
              />
            </div>
            {formError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save setting'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
