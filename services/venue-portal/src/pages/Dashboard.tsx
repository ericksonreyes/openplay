import { Link } from 'react-router-dom';
import { attr } from '../lib/api';
import { useList, today } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { PageHeader, StatusBadge } from '../components/ui';

function CountCard({ label, path, filterKey, filterValue }: { label: string; path: string; filterKey?: string; filterValue?: string }) {
  const { rows, error } = useList(path, filterKey ? { [filterKey]: filterValue } : undefined);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {error ? (
        <p className="mt-1 text-sm text-red-600">unavailable</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold text-slate-900">{rows === null ? '…' : rows.length}</p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const date = today();
  const { rows: schedule } = useList('/schedule', { date });

  return (
    <div>
      <PageHeader title="Dashboard"
        description="Today's occupancy, revenue, and pending actions at a glance." />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <CountCard label="Reservations" path="/reservations" />
        <CountCard label="Pending approval" path="/reservations" filterKey="filter[status]" filterValue="pending_approval" />
        <CountCard label="Open disputes" path="/disputes" filterKey="filter[status]" filterValue="open" />
        <CountCard label="Unread notifications" path="/notifications" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Today's schedule ({date})</h2>
          <Link to="/schedule" className="text-xs font-medium text-indigo-600 hover:underline">
            Open schedule
          </Link>
        </div>
        {schedule === null ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : schedule.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No bookings today.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-700">
                  {attr(b, 'starts_at') ? formatDateTime(attr(b, 'starts_at')) : attr(b, 'start_time') || '—'}
                  {' — '}
                  {attr(b, 'title') || attr(b, 'resource_name') || attr(b, 'customer_name') || b.type}
                </span>
                <StatusBadge status={attr(b, 'status')} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
