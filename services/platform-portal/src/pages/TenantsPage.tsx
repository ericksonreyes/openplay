import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTenants } from '../lib/api';
import type { TenantResource } from '../lib/api';
import { StatusBadge, statusLabel } from '../components/StatusBadge';

const STATUS_FILTERS = ['', 'awaiting_review', 'setup', 'active', 'suspended'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function TenantsPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [tenants, setTenants] = useState<TenantResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTenants(null);
    setError(null);
    listTenants(status || undefined)
      .then((data) => {
        if (!cancelled) setTenants(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants ?? [];
    return (tenants ?? []).filter(
      (t) =>
        t.attributes.name.toLowerCase().includes(q) ||
        t.attributes.code.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Tenants</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">Businesses requesting access — review, approve, suspend, or restore.</p>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search name or code"
            aria-label="Search tenants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-slate-600">Business</th>
              <th className="px-5 py-3 text-left font-medium text-slate-600">Code</th>
              <th className="px-5 py-3 text-left font-medium text-slate-600">Status</th>
              <th className="px-5 py-3 text-left font-medium text-slate-600">Published</th>
              <th className="px-5 py-3 text-left font-medium text-slate-600">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link
                    to={`/tenants/${t.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {t.attributes.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{t.attributes.code}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={t.attributes.status} />
                </td>
                <td className="px-5 py-3 text-slate-600">{t.attributes.published ? 'Yes' : 'No'}</td>
                <td className="px-5 py-3 text-slate-600">{formatDate(t.attributes.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <ul className="space-y-3 md:hidden">
          {filtered.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <Link to={`/tenants/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                  {t.attributes.name}
                </Link>
                <StatusBadge status={t.attributes.status} />
              </div>
              <dl className="mt-2 divide-y divide-slate-100 text-sm">
                <div className="flex justify-between py-1.5"><dt className="text-slate-500">Code</dt><dd className="text-slate-800">{t.attributes.code}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-slate-500">Published</dt><dd className="text-slate-800">{t.attributes.published ? 'Yes' : 'No'}</dd></div>
                <div className="flex justify-between py-1.5"><dt className="text-slate-500">Submitted</dt><dd className="text-slate-800">{formatDate(t.attributes.created_at)}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        {tenants === null && !error && (
          <p className="py-6 text-sm text-slate-500">Loading…</p>
        )}
        {tenants !== null && filtered.length === 0 && (
          <p className="py-6 text-sm text-slate-500">No tenants match.</p>
        )}
    </div>
  );
}
