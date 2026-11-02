import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { type FieldDef, type RowAction } from '../components/CrudPage';
import { RecordActions } from '../components/RecordActions';

/**
 * Generic record view for list-page entities that don't need a bespoke
 * detail page. Renders scalar attributes as label/value rows, drops
 * *_id / object / array fields, carries the record's actions
 * (Edit / status transitions / Delete — same gating as the table),
 * and ends with the "Show history" link.
 */
export function RecordDetailPage({
  path,
  type,
  backTo,
  stream,
  entity,
  fields = [],
  rowActions,
  canEdit = true,
  canDelete = true,
  render = {},
}: {
  /** API list path, e.g. '/prices' — detail is `${path}/:id`. */
  path: string;
  /** JSON:API type used on update, e.g. 'prices'. */
  type: string;
  /** Back link target, e.g. '/catalog/prices'. */
  backTo: string;
  /** Audit stream type, e.g. 'venue_price'. Omit to hide the history link. */
  stream?: string;
  /** Singular entity name for labels/dialogs — string or per-record (e.g. holiday vs closure). */
  entity: string | ((r: Resource) => string);
  fields?: FieldDef[];
  /** Same signature as CrudPage rowActions — page hoists it and shares it. */
  rowActions?: (r: Resource, reload: () => void) => RowAction[];
  canEdit?: boolean;
  canDelete?: boolean | { attr: string; equals: string | boolean | Array<string | boolean> };
  render?: Record<string, (v: unknown, r: Resource) => React.ReactNode>;
}) {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get(`${path}/${id}`)
      .then(setRecord)
      .catch((e: Error) => setError(e.message));
  }, [id, path]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div>
        <PageHeader title="Record" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }
  if (!record) return <Spinner />;

  const attrs = (record.attributes ?? {}) as Record<string, unknown>;
  const currency = String(attrs.currency ?? 'PHP');
  const fmt = (key: string, v: unknown): React.ReactNode => {
    if (render[key]) return render[key](v, record);
    if (v === null || v === undefined || v === '') return '—';
    if (key === 'status') return <StatusBadge status={String(v)} />;
    if (key.endsWith('_cents')) return `${currency} ${(Number(v) / 100).toFixed(2)}`;
    if (key.endsWith('_at')) return formatDateTime(String(v));
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'object') return null;
    return String(v);
  };

  const label = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const rows = Object.keys(attrs)
    .filter((k) => {
      const v = attrs[k];
      if (k.endsWith('_id') || k === 'uuid' || k === 'id') return false;
      if (v !== null && typeof v === 'object') return false;
      return true;
    })
    .sort((a, b) => {
      const rank = (k: string) =>
        ['name', 'title', 'reference_no', 'reference', 'status'].indexOf(k) !== -1
          ? 0
          : k.endsWith('_at')
            ? 2
            : 1;
      return rank(a) - rank(b);
    });

  const entityLabel = typeof entity === 'function' ? entity(record) : entity;
  const streamId = String(attrs.stream_id ?? record.id);
  const recordLabel =
    attr(record, 'name') || attr(record, 'title') || attr(record, 'reference_no') || attr(record, 'reason') || attr(record, 'label') || id || 'Record';

  return (
    <div>
      <PageHeader title={recordLabel} description={`${entityLabel} details.`}>
        <Link to={backTo} className="text-sm text-indigo-600 hover:underline">
          ← Back
        </Link>
      </PageHeader>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="divide-y divide-slate-100">
          {rows.map((k) => (
            <div key={k} className="flex justify-between gap-4 px-1 py-2 text-sm">
              <dt className="shrink-0 text-slate-500">{label(k)}</dt>
              <dd className="text-right text-slate-800">{fmt(k, attrs[k])}</dd>
            </div>
          ))}
        </dl>
        <RecordActions
          record={record}
          path={path}
          type={type}
          entity={entityLabel}
          backTo={backTo}
          fields={fields}
          rowActions={rowActions}
          canEdit={canEdit}
          canDelete={canDelete}
          onChanged={load}
        />
      </div>
      {stream && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/${stream}/${streamId}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
