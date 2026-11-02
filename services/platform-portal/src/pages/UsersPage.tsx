import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, attr, rawAttr, type Resource } from '../lib/api';
import { DataTable, type ColumnDef, type RowAction } from '../components/DataTable';
import { ConfirmDialog, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';

const displayName = (r: Resource) =>
  attr(r, 'display_name') || attr(r, 'email') || attr(r, 'username') || '—';

export const userColumns: ColumnDef[] = [
  {
    key: 'display_name',
    label: 'Name',
    render: (r) => (
      <Link to={`/users/${r.id}`} className="font-medium text-indigo-600 hover:underline">
        {displayName(r)}
      </Link>
    ),
    sortValue: displayName,
  },
  { key: 'scope', label: 'Scope' },
  {
    key: 'tenant_code',
    label: 'Tenant',
    render: (r) => attr(r, 'tenant_code') || '—',
  },
  {
    key: 'roles',
    label: 'Roles',
    sortable: false,
    render: (r) =>
      Array.isArray(r.attributes.roles) && (r.attributes.roles as string[]).length
        ? (r.attributes.roles as string[]).join(', ')
        : '—',
  },
  {
    key: 'suspended',
    label: 'Status',
    render: (r) => <StatusBadge status={rawAttr(r, 'suspended') ? 'suspended' : 'active'} />,
    sortValue: (r) => (rawAttr(r, 'suspended') ? 'suspended' : 'active'),
  },
  {
    key: 'created_at',
    label: 'Joined',
    render: (r) => fmt(attr(r, 'created_at')),
  },
];

/** Suspend/unsuspend lifecycle — shared by the Users table and user detail. */
export const userRowActions = (reload: () => void): ((r: Resource) => RowAction[]) => () => [
  {
    label: 'Suspend user',
    tableLabel: 'Suspend',
    when: { attr: 'suspended', equals: false },
    confirm: 'The user loses access until restored.',
    danger: true,
    run: (u) =>
      apiFetch(`/platform/users/${encodeURIComponent(u.id)}/suspend`, {
        method: 'POST',
        type: 'user_transition',
        attributes: {},
      }).then(reload),
  },
  {
    label: 'Unsuspend user',
    tableLabel: 'Unsuspend',
    when: { attr: 'suspended', equals: true },
    run: (u) =>
      apiFetch(`/platform/users/${encodeURIComponent(u.id)}/unsuspend`, {
        method: 'POST',
        type: 'user_transition',
        attributes: {},
      }).then(reload),
  },
];

export function UsersPage() {
  const [users, setUsers] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: RowAction; row: Resource } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<Resource[]>('/platform/users')
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.action.run(pending.row);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const actions = userRowActions(load);
  const tableActions = (r: Resource) => (
    <div className="flex justify-end gap-3">
      {actions(r)
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
              a.confirm ? setPending({ action: a, row: r }) : void a.run(r).catch((e: Error) => setError(e.message))
            }
            className={`text-sm font-medium hover:underline ${
              a.danger ? 'text-red-600' : 'text-indigo-600'
            }`}
          >
            {a.tableLabel ?? a.label}
          </button>
        ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Users"
        description="All user accounts across the platform; suspend or restore access."
      />
      {error && <ErrorState message={error} onRetry={() => setError(null)} actionLabel="Dismiss" />}
      {users === null ? (
        <Spinner />
      ) : (
        <DataTable columns={userColumns} rows={users} actions={tableActions} dateKey="created_at" />
      )}
      {pending && (
        <ConfirmDialog
          title={pending.action.label}
          message={pending.action.confirm ?? ''}
          confirmLabel={pending.action.label}
          danger={pending.action.danger}
          busy={busy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
