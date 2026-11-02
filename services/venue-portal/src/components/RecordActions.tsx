import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, attr, rawAttr, type Resource } from '../lib/api';
import { ConfirmDialog, Modal } from './ui';
import { ResourceForm, type FieldDef, type RowAction } from './CrudPage';

/**
 * Record footer: Back link left, record actions right (status transitions,
 * Edit, Delete) with the same when-gating, confirms, and dialogs as the
 * source table's row actions. Used on every record view.
 */
export function RecordActions({
  record,
  path,
  type,
  entity,
  backTo,
  fields = [],
  rowActions,
  canEdit = true,
  canDelete = true,
  mapAttrs,
  onChanged,
}: {
  record: Resource;
  /** API list path; update/delete hit `${path}/${record.id}`. */
  path: string;
  /** JSON:API type used on update. */
  type: string;
  /** Singular entity name for dialog titles, e.g. 'Facility'. */
  entity: string;
  backTo: string;
  fields?: FieldDef[];
  rowActions?: (r: Resource, reload: () => void) => RowAction[];
  canEdit?: boolean;
  canDelete?: boolean | { attr: string; equals: string | boolean | Array<string | boolean> };
  /** Adjust attrs before update (e.g. staff wraps venueIds in an array). */
  mapAttrs?: (attrs: Record<string, unknown>) => Record<string, unknown>;
  /** Called after edit/action so the parent can reload the record. */
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingAction, setPendingAction] = useState<RowAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = (rowActions?.(record, onChanged) ?? []).filter((a) => {
    if (!a.when) return true;
    const v = rawAttr(record, a.when.attr);
    const allowed = Array.isArray(a.when.equals) ? a.when.equals : [a.when.equals];
    return (allowed as unknown[]).includes(v);
  });
  const deletable =
    canDelete === true ||
    (typeof canDelete === 'object' &&
      (Array.isArray(canDelete.equals)
        ? canDelete.equals.includes(rawAttr(record, canDelete.attr) as string | boolean)
        : rawAttr(record, canDelete.attr) === canDelete.equals));

  const recordLabel =
    attr(record, 'name') || attr(record, 'title') || attr(record, 'reference_no') ||
    attr(record, 'reason') || attr(record, 'label') || attr(record, 'display_name') || 'record';

  return (
    <>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <Link
          to={backTo}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Back
        </Link>
        {(actions.length > 0 || (canEdit && fields.length > 0) || deletable) && (
          <div className="flex flex-wrap justify-end gap-3">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() =>
                  a.confirm ? setPendingAction(a) : void a.run(record).then(onChanged)
                }
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  a.danger
                    ? 'border border-red-200 text-red-700 hover:bg-red-50'
                    : 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                {a.label}
              </button>
            ))}
            {canEdit && fields.length > 0 && (
              <button
                onClick={() => setEditing(true)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
            )}
            {deletable && (
              <button
                onClick={() => setDeleting(true)}
                className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <Modal title={`Edit ${entity}`} onClose={() => setEditing(false)}>
          <ResourceForm
            fields={fields}
            initial={record}
            submitLabel="Save"
            busy={busy}
            onSubmit={async (attrs) => {
              setBusy(true);
              try {
                await api.update(`${path}/${record.id}`, type, mapAttrs ? mapAttrs(attrs) : attrs);
                setEditing(false);
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${entity}`}
          message={`Delete "${recordLabel}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            setBusy(true);
            try {
              await api.remove(`${path}/${record.id}`);
              navigate(backTo);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Delete failed.');
              setDeleting(false);
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setDeleting(false)}
          busy={busy}
        />
      )}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.label}
          message={pendingAction.confirm ?? pendingAction.label}
          danger={pendingAction.danger}
          onConfirm={async () => {
            setBusy(true);
            try {
              await pendingAction.run(record);
              setPendingAction(null);
              onChanged();
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setPendingAction(null)}
          busy={busy}
        />
      )}
    </>
  );
}
