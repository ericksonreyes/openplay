import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';

interface PlatformUser {
  id: string;
  attributes: {
    scope: string;
    username: string | null;
    email: string | null;
    display_name: string | null;
    tenant_code: string | null;
    roles: string[];
    suspended: boolean;
    created_at: string;
  };
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

export function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<PlatformUser[]>('/platform/users')
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const toggle = async (u: PlatformUser) => {
    setBusyId(u.id);
    try {
      await apiFetch(`/platform/users/${encodeURIComponent(u.id)}/${u.attributes.suspended ? 'unsuspend' : 'suspend'}`, {
        method: 'POST',
        type: 'user_transition',
        attributes: {},
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!users) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Users</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">All user accounts across the platform; suspend or restore access.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Scope</th>
              <th className="px-5 py-3">Tenant</th>
              <th className="px-5 py-3">Roles</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-3">
                  <Link to={`/users/${u.id}`} className="font-medium text-indigo-600 hover:underline">
                    {u.attributes.display_name || u.attributes.email || u.attributes.username || '—'}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{u.attributes.scope}</td>
                <td className="px-5 py-3 text-slate-600">{u.attributes.tenant_code || '—'}</td>
                <td className="px-5 py-3 text-slate-600">{u.attributes.roles.join(', ') || '—'}</td>
                <td className="px-5 py-3"><StatusBadge status={u.attributes.suspended ? 'suspended' : 'active'} /></td>
                <td className="px-5 py-3 text-slate-600">{fmt(u.attributes.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => toggle(u)}
                    disabled={busyId === u.id}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    {u.attributes.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <Link to={`/users/${u.id}`} className="font-medium text-indigo-600 hover:underline">
                {u.attributes.display_name || u.attributes.email || u.attributes.username || '—'}
              </Link>
              <StatusBadge status={u.attributes.suspended ? 'suspended' : 'active'} />
            </div>
            <dl className="mt-2 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-1.5"><dt className="text-slate-500">Scope</dt><dd className="text-slate-800">{u.attributes.scope}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-slate-500">Tenant</dt><dd className="text-slate-800">{u.attributes.tenant_code || '—'}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-slate-500">Roles</dt><dd className="text-slate-800">{u.attributes.roles.join(', ') || '—'}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-slate-500">Joined</dt><dd className="text-slate-800">{fmt(u.attributes.created_at)}</dd></div>
            </dl>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => toggle(u)}
                disabled={busyId === u.id}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {u.attributes.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
