import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList, today } from '../lib/hooks';
import { formatSlot } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
import { activityRowActions, ACTIVITY_FIELDS } from './catalog';

/** An activity's home: identity + linked facilities + today's usage. */
export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rows: resources } = useList('/resources');
  const { rows: schedule } = useList('/schedule', { date: today() });

  const load = () =>
    api
      .get(`/activities/${id}`)
      .then(setActivity)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!activity) return <Spinner />;

  const linkedIds = (activity.attributes?.resource_ids as string[] | undefined) ?? [];
  const linked = linkedIds
    .map((rid) => (resources ?? []).find((r) => r.id === rid))
    .filter(Boolean) as Resource[];
  const todayUses = (schedule ?? []).filter(
    (r) => attr(r, 'activity_id') === activity.id || attr(r, 'activity_name') === attr(activity, 'name'),
  );

  return (
    <div>
      <PageHeader title={attr(activity, 'name') || 'Activity'} description="This activity’s setup and today’s scheduled uses.">
        <Link to="/catalog/activities" className="text-sm text-indigo-600 hover:underline">
          ← All activities
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={attr(activity, 'status') || 'unknown'} />],
              ['Code', attr(activity, 'code') || '—'],
              ['Duration', attr(activity, 'duration_minutes') ? `${attr(activity, 'duration_minutes')} min` : '—'],
              ['Description', attr(activity, 'description') || '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <RecordActions
            record={activity}
            path="/activities"
            type="activities"
            entity="Activity"
            backTo="/catalog/activities"
            fields={ACTIVITY_FIELDS}
            rowActions={(r) => activityRowActions(r)}
            canDelete={{ attr: 'status', equals: 'draft' }}
            onChanged={load}
          />
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-900">
            Linked facilities ({linked.length})
          </h3>
          {linked.length === 0 ? (
            <EmptyState message="No linked facilities." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {linked.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-1 py-2 text-sm">
                  <Link to={`/catalog/resources/${r.id}`} className="text-indigo-600 hover:underline">
                    {attr(r, 'name')}
                  </Link>
                  <StatusBadge status={attr(r, 'status')} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Today's uses ({todayUses.length})
          </h2>
          {todayUses.length === 0 ? (
            <EmptyState message="Nothing scheduled for this activity today." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayUses.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">
                    {attr(r, 'customer_name') || attr(r, 'reference_no') || '—'}
                    {' · '}
                    {formatSlot(attr(r, 'starts_at'), attr(r, 'ends_at'))}
                  </span>
                  <StatusBadge status={attr(r, 'status')} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {activity && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/venue_activity/${activity.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
