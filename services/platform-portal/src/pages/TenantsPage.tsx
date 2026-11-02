import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attr, listTenants, type Resource } from '../lib/api';
import { DataTable, statusColumn, type ColumnDef } from '../components/DataTable';
import { ErrorState, PageHeader, Spinner, statusLabel } from '../components/ui';

const STATUS_FILTERS = ['', 'awaiting_review', 'setup', 'active', 'suspended'];

const columns: ColumnDef[] = [
  {
    key: 'name',
    label: 'Business',
    render: (r) => (
      <Link to={`/tenants/${r.id}`} className="font-medium text-indigo-600 hover:underline">
        {attr(r, 'name')}
      </Link>
    ),
  },
  { key: 'code', label: 'Code' },
  statusColumn(),
  {
    key: 'published',
    label: 'Published',
    render: (r) => (r.attributes.published ? 'Yes' : 'No'),
    sortValue: (r) => (r.attributes.published ? 'yes' : 'no'),
  },
  {
    key: 'created_at',
    label: 'Submitted',
    render: (r) => new Date(attr(r, 'created_at')).toLocaleDateString(undefined, { dateStyle: 'medium' }),
  },
];

export function TenantsPage() {
  const [status, setStatus] = useState('');
  const [tenants, setTenants] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTenants(null);
    setError(null);
    listTenants(status || undefined)
      .then((data) => {
        if (!cancelled) setTenants(data as unknown as Resource[]);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Businesses requesting access — review, approve, suspend, or restore."
      />
      {error && <ErrorState message={error} onRetry={() => setError(null)} actionLabel="Dismiss" />}
      {tenants === null ? (
        <Spinner />
      ) : (
        <DataTable
          columns={columns}
          rows={tenants}
          toolbar={
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === '' ? 'All statuses' : statusLabel(s)}
                </option>
              ))}
            </select>
          }
        />
      )}
    </div>
  );
}
