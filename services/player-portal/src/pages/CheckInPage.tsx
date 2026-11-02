import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attr, attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

function isToday(resource: JsonApiResource): boolean {
  const raw = attr(resource, 'starts_at', 'start', 'date');
  if (!raw) return true; // if the API gives no date, show it — server scoping will filter
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function CheckInPage() {
  const { token } = useAuth();
  const { data, error, loading, reload } = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>('/reservations', { token: t }),
    [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());

  const todays = (data ?? []).filter((r) => {
    const status = attrString(r, 'status').toLowerCase();
    return isToday(r) && !['cancelled', 'canceled', 'declined', 'expired'].includes(status);
  });

  async function onCheckIn(reservationId: string) {
    setBusyId(reservationId);
    setActionError(null);
    try {
      await jsonApi('/check-ins', {
        method: 'POST',
        token,
        body: envelope('check-ins', { reservation_id: reservationId }),
      });
      setCheckedIn((prev) => new Set(prev).add(reservationId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Check-in" description="Check in for today’s bookings when you arrive." />
      {actionError && <div className="mb-4"><ErrorState message={actionError} actionLabel="Dismiss" onRetry={() => setActionError(null)} /></div>}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : todays.length === 0 ? (
        <EmptyState title="Nothing to check in to today" hint="Today's reservations appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {todays.map((r) => {
            const done = checkedIn.has(r.id);
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-slate-900">{displayName(r, 'Reservation')}</h3>
                  <StatusBadge status={done ? 'checked-in' : attrString(r, 'status')} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDateTime(attrString(r, 'starts_at', 'start', 'date'))}
                </p>
                <button
                  onClick={() => onCheckIn(r.id)}
                  disabled={done || busyId === r.id}
                  className={`mt-3 rounded-md px-4 py-2 text-sm font-medium ${
                    done
                      ? 'bg-green-100 text-green-800'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                  }`}
                >
                  {done ? 'Checked in' : busyId === r.id ? 'Checking in…' : 'Check in'}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
