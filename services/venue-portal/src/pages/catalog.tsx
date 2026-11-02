import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { countries, DEFAULT_COUNTRY, formatDateTime, formatMoney, ianaTimezones } from '../lib/format';
import { api, attr, rawAttr, type Resource } from '../lib/api';
import { CrudPage, statusColumn, type FieldDef, type RowAction } from '../components/CrudPage';
import { RecordDetailPage } from './RecordDetailPage';
import { useList } from '../lib/hooks';
import { Badge, StatusBadge } from '../components/ui';

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
        description="Your bookable spaces. A venue groups facilities, prices and closures."
      path="/venues"
      type="venues"
      canDelete={{ attr: 'status', equals: 'draft' }}
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
      fields={VENUE_FIELDS}
      rowActions={(r) => venueRowActions(r)}
      emptyMessage="No venues yet. Create your first venue."
    />
  );
}

export const VENUE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'details.description', label: 'Description', type: 'textarea' },
  { name: 'address.line1', label: 'Address line 1' },
  { name: 'address.line2', label: 'Address line 2' },
  { name: 'address.city', label: 'City' },
  { name: 'address.region', label: 'Region / State' },
  { name: 'address.country', label: 'Country', type: 'select', required: true, defaultValue: DEFAULT_COUNTRY, options: countries() },
  {
    name: 'timezone',
    label: 'Timezone',
    type: 'select',
    required: true,
    options: ianaTimezones(),
    help: 'Used for slot times and schedules at this venue.',
  },
];

/** Activate / Recommission / Decommission — shared table + detail page. */
export const venueRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Activate venue',
    tableLabel: 'Activate',
    when: { attr: 'status', equals: 'draft' },
    confirm: 'Activate this venue? It becomes bookable.',
    run: () => api.update(`/venues/${r.id}`, 'venue', { status: 'active' }),
  },
  {
    label: 'Recommission venue',
    tableLabel: 'Recommission',
    when: { attr: 'status', equals: 'archived' },
    confirm: 'Recommission this venue? It becomes bookable again.',
    run: () => api.update(`/venues/${r.id}`, 'venue', { status: 'active' }),
  },
  {
    label: 'Decommission venue',
    tableLabel: 'Decommission',
    when: { attr: 'status', equals: 'active' },
    confirm: 'Decommission this venue? Bookings and history are kept; it stops being bookable.',
    danger: true,
    run: () => api.update(`/venues/${r.id}`, 'venue', { status: 'archived' }),
  },
];

export const facilityRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Commission facility',
    tableLabel: 'Commission',
    when: { attr: 'status', equals: 'draft' },
    confirm: 'Commission this facility? It becomes bookable.',
    run: () => api.update(`/resources/${r.id}`, 'resources', { status: 'active' }),
  },
  {
    label: 'Recommission facility',
    tableLabel: 'Recommission',
    when: { attr: 'status', equals: 'archived' },
    confirm: 'Recommission this facility? It becomes bookable again.',
    run: () => api.update(`/resources/${r.id}`, 'resources', { status: 'active' }),
  },
  {
    label: 'Decommission facility',
    tableLabel: 'Decommission',
    when: { attr: 'status', equals: 'active' },
    confirm: 'Decommission this facility? Bookings and history are kept; it stops being bookable.',
    danger: true,
    run: () => api.update(`/resources/${r.id}`, 'resources', { status: 'archived' }),
  },
];

export const RESOURCE_FIELDS_TAIL: FieldDef[] = [
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
];

export const activityRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Publish activity',
    tableLabel: 'Publish',
    when: { attr: 'status', equals: ['draft', 'archived'] },
    confirm: 'Publish this activity? It becomes bookable.',
    run: () => api.update(`/activities/${r.id}`, 'activities', { status: 'active' }),
  },
  {
    label: 'Unpublish activity',
    tableLabel: 'Unpublish',
    when: { attr: 'status', equals: 'active' },
    confirm: 'Unpublish this activity? Linked records and history are kept; it stops being bookable.',
    danger: true,
    run: () => api.update(`/activities/${r.id}`, 'activities', { status: 'archived' }),
  },
];

export const ACTIVITY_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
];

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
      title="Facilities"
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
        ...RESOURCE_FIELDS_TAIL,
      ]}
      rowActions={(r) => facilityRowActions(r)}
      canDelete={{ attr: 'status', equals: 'draft' }}
      emptyMessage="No facilities yet."
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
        description="Named activities offered at your venues; link them to the facilities they can use."
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
            label: 'Facilities',
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
        fields={ACTIVITY_FIELDS}
        canDelete={{ attr: 'status', equals: 'draft' }}
        rowActions={(r) => [
          ...activityRowActions(r),
          {
            label: 'Link facilities',
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
              Link facilities — {attr(linking, 'name')}
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
            <div className="mt-5 flex justify-end gap-3">
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
      detailPath={(r) => `/catalog/prices/${r.id}`}
        description="Per-activity or per-facility rates applied when a reservation is priced."
      path="/prices"
      type="prices"
      columns={[
        { key: 'label', label: 'Name' },
        { key: 'amount', label: 'Amount', render: (r) => formatMoney(attr(r, 'amount_cents'), attr(r, 'currency')) },
        {
          key: 'activity_id',
          label: 'Activity',
          render: (r) => activities.find((a) => a.value === attr(r, 'activity_id'))?.label ?? '—',
        },
        {
          key: 'resource_id',
          label: 'Facility',
          render: (r) => resources.find((a) => a.value === attr(r, 'resource_id'))?.label ?? '—',
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => <StatusBadge status={rawAttr(r, 'active') ? 'published' : 'unpublished'} />,
        },
      ]}
      fields={priceFields(activities, resources)}
      rowActions={(r) => priceRowActions(r)}
      canDelete={false}
      emptyMessage="No prices defined."
    />
  );
}

export const priceRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Publish price',
    tableLabel: 'Publish',
    when: { attr: 'active', equals: false },
    confirm: 'Publish this price? It applies to new bookings.',
    run: () => api.update(`/prices/${r.id}`, 'prices', { active: true }),
  },
  {
    label: 'Unpublish price',
    tableLabel: 'Unpublish',
    when: { attr: 'active', equals: true },
    confirm: 'Unpublish this price? Existing bookings keep their quoted amounts.',
    danger: true,
    run: () => api.update(`/prices/${r.id}`, 'prices', { active: false }),
  },
];

/** Shared field/action config — used by both the table and the detail page. */
const priceFields = (
  activities: { value: string; label: string }[],
  resources: { value: string; label: string }[],
): FieldDef[] => [
  { name: 'label', label: 'Name', required: true },
  { name: 'amount_cents', label: 'Amount', type: 'number', required: true, toCents: true },
  { name: 'currency', label: 'Currency', placeholder: 'PHP' },
  { name: 'activity_id', label: 'Activity', type: 'select', options: activities },
  { name: 'resource_id', label: 'Facility', type: 'select', options: resources },
  { name: 'unit', label: 'Unit', type: 'select', options: [{ value: 'hour', label: 'Per hour' }, { value: 'day', label: 'Per day' }, { value: 'session', label: 'Per session' }] },
];

export function PriceDetailPage() {
  const activities = useOptions('/activities');
  const resources = useOptions('/resources');
  return (
    <RecordDetailPage
      path="/prices"
      type="prices"
      backTo="/catalog/prices"
      stream="venue_price"
      entity="Price"
      fields={priceFields(activities, resources)}
      rowActions={(r) => priceRowActions(r)}
      canDelete={false}
    />
  );
}

export function FacilityRulesPage() {
  const venues = useOptions('/venues');
  return (
    <CrudPage
      title="Facility rules"
      detailPath={(r) => `/catalog/facility-rules/${r.id}`}
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
      fields={ruleFields(venues)}
      rowActions={ruleRowActions}
      canDelete={{ attr: 'status', equals: 'draft' }}
      emptyMessage="No facility rules yet."
    />
  );
}

const ruleFields = (venues: { value: string; label: string }[]): FieldDef[] => [
  { name: 'title', label: 'Title', required: true },
  { name: 'body', label: 'Body', type: 'textarea', required: true },
  { name: 'venue_id', label: 'Venue', type: 'select', options: venues },
  { name: 'requires_acknowledgment', label: 'Requires acknowledgment', type: 'checkbox' },
];

const ruleRowActions = (r: Resource): RowAction[] => [
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
];

export function FacilityRuleDetailPage() {
  const venues = useOptions('/venues');
  return (
    <RecordDetailPage
      path="/facility-rules"
      type="facility-rules"
      backTo="/catalog/facility-rules"
      stream="facility_rules"
      entity="Facility rule"
      fields={ruleFields(venues)}
      rowActions={(r) => ruleRowActions(r)}
      canDelete={{ attr: 'status', equals: 'draft' }}
    />
  );
}

export function ClosuresPage() {
  const venues = useOptions('/venues');
  const resources = useOptions('/resources');
  const [venueId, setVenueId] = useState('');
  return (
    <CrudPage
      title="Closures"
      detailPath={(r) => `/catalog/closures/${r.id}`}
        description="Date ranges when a resource or venue is unavailable for booking."
      path="/closures"
      type="closures"
      params={{ venue_id: venueId || undefined, kind: 'closure,internal_use' }}
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
        { key: 'reason', label: 'Reason' },
        { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(attr(r, 'starts_at')) },
        { key: 'ends_at', label: 'Ends', render: (r) => formatDateTime(attr(r, 'ends_at')) },
        {
          key: 'recurrence',
          label: 'Repeats',
          render: (r) => {
            const rule = String((rawAttr(r, 'recurrence') as { rule?: string } | null)?.rule ?? '');
            if (rule.includes('WEEKLY')) return 'Weekly';
            if (rule.includes('MONTHLY')) return 'Monthly';
            if (rule.includes('YEARLY')) return 'Annually';
            return '—';
          },
        },
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
          label: 'Facility',
          render: (r) => resources.find((v) => v.value === attr(r, 'resource_id'))?.label ?? '—',
        },
      ]}
      fields={closureFields(venues, resources)}
      rowActions={(r) => closureRowActions(r)}
      canDelete={false}
      emptyMessage="No closures scheduled."
    />
  );
}

const closureFields = (
  venues: { value: string; label: string }[],
  resources: { value: string; label: string }[],
): FieldDef[] => [
  { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venues },
  { name: 'resource_id', label: 'Facility (optional — blank = whole venue)', type: 'select', options: resources },
  { name: 'reason', label: 'Reason', required: true },
  { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
  { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
  {
    name: 'recurrence.rule',
    label: 'Repeats',
    type: 'select',
    options: [
      { value: 'FREQ=WEEKLY', label: 'Weekly' },
      { value: 'FREQ=MONTHLY', label: 'Monthly — same day of month' },
      { value: 'FREQ=YEARLY', label: 'Annually — same date' },
    ],
    help: 'Blank = one-off. Recurring closures keep blocking future dates.',
  },
  {
    name: 'recurrence.byday',
    label: 'Day of week (weekly only)',
    type: 'select',
    options: [
      { value: 'MO', label: 'Monday' },
      { value: 'TU', label: 'Tuesday' },
      { value: 'WE', label: 'Wednesday' },
      { value: 'TH', label: 'Thursday' },
      { value: 'FR', label: 'Friday' },
      { value: 'SA', label: 'Saturday' },
      { value: 'SU', label: 'Sunday' },
    ],
    help: 'Which weekday the weekly closure falls on — blank uses the start date’s weekday.',
  },
];

export const holidayRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Unpublish holiday',
    tableLabel: 'Unpublish',
    when: { attr: 'status', equals: 'scheduled' },
    confirm: 'Unpublish this holiday? The date opens up for booking every year; the record is kept for history.',
    danger: true,
    run: () => api.update(`/closures/${r.id}`, 'closures', { status: 'cancelled' }),
  },
  {
    label: 'Publish holiday',
    tableLabel: 'Publish',
    when: { attr: 'status', equals: 'cancelled' },
    confirm: 'Publish this holiday? The venue closes on this date every year.',
    run: () => api.update(`/closures/${r.id}`, 'closures', { status: 'scheduled' }),
  },
];

export const closureRowActions = (r: Resource): RowAction[] => [
  {
    label: 'Cancel closure',
    tableLabel: 'Cancel',
    when: { attr: 'status', equals: 'scheduled' },
    confirm: 'Cancel this closure? The affected slots free up; the record is kept for history.',
    danger: true,
    run: () => api.update(`/closures/${r.id}`, 'closures', { status: 'cancelled' }),
  },
];

export function ClosureDetailPage() {
  const venues = useOptions('/venues');
  const resources = useOptions('/resources');
  return (
    <RecordDetailPage
      path="/closures"
      type="closures"
      backTo="/catalog/closures"
      stream="closure"
      entity={(r) => (attr(r, 'kind') === 'holiday' ? 'Holiday' : 'Closure')}
      fields={closureFields(venues, resources)}
      rowActions={(r) => (attr(r, 'kind') === 'holiday' ? holidayRowActions(r) : closureRowActions(r))}
      canDelete={false}
    />
  );
}
