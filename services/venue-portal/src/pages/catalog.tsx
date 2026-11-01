import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { formatDateTime, formatMoney } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { CrudPage, statusColumn, type FieldDef } from '../components/CrudPage';
import { useList } from '../lib/hooks';
import { Badge } from '../components/ui';

function useOptions(path: string, labelKey = 'name') {
  const { rows } = useList(path);
  return useMemo(
    () =>
      (rows ?? []).map((r) => ({
        value: r.id,
        label: attr(r, labelKey) || r.id,
      })),
    [rows, labelKey],
  );
}

export function VenuesPage() {
  return (
    <CrudPage
      title="Venues"
        description="Your bookable spaces. A venue groups resources, prices and closures."
      path="/venues"
      type="venues"
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (r) => (
            <Link to={`/catalog/venues/${r.id}`} className="font-medium text-indigo-600 hover:underline">
              {attr(r, 'name') || '—'}
            </Link>
          ),
        },
        { key: 'code', label: 'Code' },
        {
          key: 'address',
          label: 'Address',
          render: (r) => {
            const a = (attr(r, 'address') ?? null) as unknown;
            if (!a || typeof a !== 'object') return '—';
            const parts = ['line1', 'city', 'country']
              .map((k) => (a as Record<string, string>)[k])
              .filter(Boolean);
            return parts.length ? parts.join(', ') : '—';
          },
        },
        { key: 'timezone', label: 'Timezone' },
        statusColumn(),
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'address', label: 'Address' },
        { name: 'timezone', help: 'IANA timezone like Asia/Manila; drives slot times and schedule.' , label: 'Timezone', placeholder: 'Asia/Manila' },
      ]}
      rowActions={(r) => [
        {
          label: 'Publish',
          when: { attr: 'status', equals: ['draft', 'unpublished'] },
          confirm: 'Publish this venue? It will appear on the public site.',
          run: () => api.action(`/venues/${r.id}/publish`),
        },
        {
          label: 'Unpublish',
          when: { attr: 'status', equals: 'published' },
          confirm: 'Unpublish this venue?',
          run: () => api.action(`/venues/${r.id}/unpublish`),
        },
      ]}
      emptyMessage="No venues yet. Create your first venue."
    />
  );
}

export function ResourcesPage() {
  const venues = useOptions('/venues');
  const [venueId, setVenueId] = useState('');
  const venueField: FieldDef = {
    name: 'venue_id',
    label: 'Venue',
    type: 'select',
    required: true,
    options: venues,
  };
  return (
    <CrudPage
      title="Resources"
        description="Individual bookable units (courts, rooms, lanes) belonging to a venue."
      path="/resources"
      type="resources"
      params={{ 'filter[venue_id]': venueId || undefined }}
      toolbar={
        <select
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Filter by venue"
        >
          <option value="">All venues</option>
          {venues.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      }
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (r) => (
            <Link to={`/catalog/resources/${r.id}`} className="font-medium text-indigo-600 hover:underline">
              {attr(r, 'name') || '—'}
            </Link>
          ),
        },
        { key: 'kind', label: 'Kind' },
        { key: 'capacity', label: 'Capacity' },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => venues.find((v) => v.value === attr(r, 'venue_id'))?.label ?? '—',
        },
        statusColumn(),
      ]}
      fields={[
        venueField,
        { name: 'name', label: 'Name', required: true },
        {
          name: 'kind',
          label: 'Kind',
          type: 'select',
          options: [
            { value: 'court', label: 'Court' },
            { value: 'room', label: 'Room' },
            { value: 'field', label: 'Field' },
            { value: 'lane', label: 'Lane' },
            { value: 'table', label: 'Table' },
          ],
        },
        { name: 'capacity', label: 'Capacity', type: 'number' },
      ]}
      emptyMessage="No resources yet."
    />
  );
}

export function ActivitiesPage() {
  const resources = useOptions('/resources');
  const [selected, setSelected] = useState<string[]>([]);
  const [linking, setLinking] = useState<Resource | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function saveLinks() {
    if (!linking) return;
    setLinkError(null);
    try {
      await api.update(`/activities/${linking.id}`, 'activities', { resource_ids: selected });
      setLinking(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to save links.');
    }
  }

  return (
    <div>
      <CrudPage
        title="Activities"
        description="Named activities offered at your venues; link them to the resources they can use."
        path="/activities"
        type="activities"
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (r) => (
              <Link to={`/catalog/activities/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                {attr(r, 'name') || '—'}
              </Link>
            ),
          },
          { key: 'duration_minutes', label: 'Duration (min)' },
          {
            key: 'resource_ids',
            label: 'Resources',
            render: (r) => {
              const ids = (r.attributes?.resource_ids as string[] | undefined) ?? [];
              const labels = ids
                .map((id) => resources.find((o) => o.value === id)?.label)
                .filter(Boolean);
              if (!labels.length) return '—';
              return (
                <span className="flex flex-wrap gap-1">
                  {labels.map((label) => (
                    <Badge key={label}>{label}</Badge>
                  ))}
                </span>
              );
            },
          },
          statusColumn(),
        ]}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
        ]}
        rowActions={(r) => [
          {
            label: 'Link resources',
            run: async () => {
              setSelected(((r.attributes?.resource_ids as string[] | undefined) ?? []).slice());
              setLinking(r);
            },
          },
        ]}
        emptyMessage="No activities yet."
      />
      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Link resources — {attr(linking, 'name')}
            </h2>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {resources.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, o.value] : s.filter((x) => x !== o.value),
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {linkError && (
              <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {linkError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setLinking(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={saveLinks}
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Save links
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PricesPage() {
  const activities = useOptions('/activities');
  const resources = useOptions('/resources');
  return (
    <CrudPage
      title="Prices"
        description="Per-activity or per-resource rates applied when a reservation is priced."
      path="/prices"
      type="prices"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', render: (r) => formatMoney(attr(r, 'amount_cents') || attr(r, 'price_cents') || attr(r, 'amount'), attr(r, 'currency')) },
        {
          key: 'activity_id',
          label: 'Activity',
          render: (r) => activities.find((a) => a.value === attr(r, 'activity_id'))?.label ?? '—',
        },
        {
          key: 'resource_id',
          label: 'Resource',
          render: (r) => resources.find((a) => a.value === attr(r, 'resource_id'))?.label ?? '—',
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'currency', label: 'Currency', placeholder: 'PHP' },
        { name: 'activity_id', label: 'Activity', type: 'select', options: activities },
        { name: 'resource_id', label: 'Resource', type: 'select', options: resources },
      ]}
      emptyMessage="No prices defined."
    />
  );
}

export function FacilityRulesPage() {
  const venues = useOptions('/venues');
  return (
    <CrudPage
      title="Facility rules"
      path="/facility-rules"
      type="facility-rules"
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => {
              const id = attr(r, 'venue_id');
              const label = venues.find((v) => v.value === id)?.label;
              return id && label ? (
                <Link to={`/catalog/venues/${id}`} className="text-indigo-600 hover:underline">{label}</Link>
              ) : (
                '—'
              );
            },
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'body', label: 'Body', type: 'textarea', required: true },
        { name: 'venue_id', label: 'Venue', type: 'select', options: venues },
        { name: 'requires_acknowledgment', label: 'Requires acknowledgment', type: 'checkbox' },
      ]}
      rowActions={(r) => [
        {
          label: 'Publish',
          when: { attr: 'status', equals: ['draft', 'unpublished'] },
          confirm: 'Publish this rule?',
          run: () => api.action(`/facility-rules/${r.id}/publish`),
        },
        {
          label: 'Unpublish',
          when: { attr: 'status', equals: 'published' },
          confirm: 'Unpublish this rule?',
          run: () => api.action(`/facility-rules/${r.id}/unpublish`),
        },
      ]}
      emptyMessage="No facility rules yet."
    />
  );
}

export function ClosuresPage() {
  const venues = useOptions('/venues');
  const resources = useOptions('/resources');
  return (
    <CrudPage
      title="Closures"
        description="Date ranges when a resource or venue is unavailable for booking."
      path="/closures"
      type="closures"
      columns={[
        { key: 'reason', label: 'Reason' },
        { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(attr(r, 'starts_at')) },
        { key: 'ends_at', label: 'Ends', render: (r) => formatDateTime(attr(r, 'ends_at')) },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => {
              const id = attr(r, 'venue_id');
              const label = venues.find((v) => v.value === id)?.label;
              return id && label ? (
                <Link to={`/catalog/venues/${id}`} className="text-indigo-600 hover:underline">{label}</Link>
              ) : (
                '—'
              );
            },
        },
        {
          key: 'resource_id',
          label: 'Resource',
          render: (r) => resources.find((v) => v.value === attr(r, 'resource_id'))?.label ?? '—',
        },
      ]}
      fields={[
        { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venues },
        { name: 'resource_id', label: 'Resource (optional — blank = whole venue)', type: 'select', options: resources },
        { name: 'reason', label: 'Reason', required: true },
        { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
        { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
      ]}
      emptyMessage="No closures scheduled."
    />
  );
}
