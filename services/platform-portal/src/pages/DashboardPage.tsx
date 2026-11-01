import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTenants } from '../lib/api';
import type { TenantResource } from '../lib/api';
import { StatusBadge, statusLabel } from '../components/StatusBadge';

const STATUS_ORDER = ['awaiting_review', 'setup', 'active', 'suspended'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function DashboardPage() {
  const [tenants, setTenants] = useState<TenantResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTenants()
      .then((data) => {
        if (!cancelled) setTenants(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tenants ?? []) {
      map.set(t.attributes.status, (map.get(t.attributes.status) ?? 0) + 1);
    }
    return map;
  }, [tenants]);

  const recent = useMemo(() => (tenants ?? []).slice(0, 5), [tenants]);

  if (error) {
    return <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!tenants) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">At-a-glance view of pending tenant applications and platform health.</p>

      <section aria-label="Tenants by status" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {statusLabel(status)}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.get(status) ?? 0}</p>
          </div>
        ))}
      </section>

      <section aria-label="Recent submissions" className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent submissions</h2>
          <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No tenant submissions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link
                    to={`/tenants/${t.id}`}
                    className="text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {t.attributes.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {t.attributes.code} · submitted {formatDate(t.attributes.created_at)}
                  </p>
                </div>
                <StatusBadge status={t.attributes.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
