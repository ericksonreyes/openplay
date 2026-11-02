import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, attr, rawAttr, type Resource } from '../lib/api';
import { ConfirmDialog, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import type { RowAction } from '../components/DataTable';
import { userRowActions } from './UsersPage';

/** Resolved from the users list — GET /platform/users/:id doesn't exist yet. */
export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RowAction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<Resource[]>('/platform/users')
      .then((rows) => setUser(rows.find((u) => u.id === id) ?? null))
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.run(user!);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/users" className="text-sm text-indigo-600 hover:underline">
          ← Back to users
        </Link>
        <ErrorState message={error} onRetry={() => setError(null)} actionLabel="Dismiss" />
      </div>
    );
  }
  if (!user) return <Spinner />;

  const a = user.attributes;
  const title = attr(user, 'display_name') || attr(user, 'email') || attr(user, 'username') || 'User';
  const status = rawAttr(user, 'suspended') ? 'suspended' : 'active';
  const actions = userRowActions(load)(user).filter((act) => {
    if (!act.when) return true;
    const v = rawAttr(user, act.when.attr);
    const allowed = Array.isArray(act.when.equals) ? act.when.equals : [act.when.equals];
    return (allowed as unknown[]).includes(v);
  });

  const fields: [string, string][] = [
    ['Scope', attr(user, 'scope') || '—'],
    ['Email', attr(user, 'email') || '—'],
    ['Username', attr(user, 'username') || '—'],
    ['Tenant', attr(user, 'tenant_code') || '—'],
    [
      'Roles',
      Array.isArray(a.roles) && (a.roles as string[]).length
        ? (a.roles as string[]).join(', ')
        : '—',
    ],
    ['Joined', a.created_at ? new Date(String(a.created_at)).toLocaleString() : '—'],
    ['User ID', user.id],
  ];

  return (
    <div>
      <PageHeader title={title} description="This user’s identity, scope, and account status.">
        <StatusBadge status={status} />
      </PageHeader>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 break-all text-sm text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            to="/users"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </Link>
          {actions.length > 0 && (
            <div className="flex flex-wrap justify-end gap-3">
              {actions.map((act) => (
                <button
                  key={act.label}
                  onClick={() =>
                    act.confirm ? setPending(act) : void act.run(user).catch((e: Error) => setError(e.message))
                  }
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    act.danger
                      ? 'border border-red-300 text-red-700 hover:bg-red-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      {pending && (
        <ConfirmDialog
          title={pending.label}
          message={pending.confirm ?? ''}
          confirmLabel={pending.label}
          danger={pending.danger}
          busy={busy}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
