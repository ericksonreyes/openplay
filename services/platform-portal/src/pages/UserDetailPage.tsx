import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

/** Resolved from the users list — GET /platform/users/:id doesn't exist yet. */
export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<{ id: string; attributes: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ id: string; attributes: Record<string, unknown> }[]>('/platform/users')
      .then((rows) => setUser(rows.find((u) => u.id === id) ?? null))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <p role="alert" className="flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <button onClick={() => setError(null)} className="ml-4 text-xs font-medium underline">Dismiss</button>
      </p>
    );
  if (!user) return <p className="text-sm text-slate-500">Loading…</p>;
  const a = user.attributes;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          {String(a.display_name || a.email || a.username || 'User')}
        </h1>
        <Link to="/users" className="text-sm text-indigo-600 hover:underline">← All users</Link>
      </div>
      <p className="-mt-3 mb-4 max-w-prose text-sm text-slate-500">This user’s identity, scope, and account status.</p>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="divide-y divide-slate-100">
          {[
            ['Scope', String(a.scope ?? '—')],
            ['Email', String(a.email || '—')],
            ['Username', String(a.username || '—')],
            ['Tenant', String(a.tenant_code || '—')],
            ['Roles', Array.isArray(a.roles) && a.roles.length ? a.roles.join(', ') : '—'],
            ['Status', <StatusBadge key="s" status={a.suspended ? 'suspended' : 'active'} />],
            ['Joined', a.created_at ? new Date(String(a.created_at)).toLocaleString() : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between px-1 py-2 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
