import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, EmptyState, ErrorState, Loading, PageHeader } from '../components/ui';

export function NotificationsPage() {
  const { data, error, loading, reload } = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/notifications', { token }),
    [],
  );

  return (
    <div>
      <PageHeader title="Notifications" description="Booking confirmations, reminders, and updates." />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id}>
              <Card>
                <p className="text-sm font-medium text-slate-900">
                  {displayName(n, 'Notification')}
                </p>
                {attrString(n, 'body', 'message', 'detail') && (
                  <p className="mt-1 text-sm text-slate-600">
                    {attrString(n, 'body', 'message', 'detail')}
                  </p>
                )}
                {attrString(n, 'created_at', 'sent_at') && (
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(attrString(n, 'created_at', 'sent_at'))}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
