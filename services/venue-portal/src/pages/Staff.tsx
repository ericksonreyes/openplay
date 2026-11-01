import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api, attr, type Resource } from '../lib/api';
import { DataTable, ResourceForm, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';

const roleOptions = [
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'front_desk', label: 'Front desk' },
];

export function StaffPage() {
  const { rows, error, reload } = useList('/staff');
  const { rows: venues } = useList('/venues');
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);

  const venueOptions = (venues ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') }));

  return (
    <div>
      <PageHeader title="Staff"
        description="People with access to this venue portal and their assigned roles.">
        <button
          onClick={() => setInviting(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Invite staff
        </button>
      </PageHeader>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No staff members yet. Invite your first teammate." />
      ) : (
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (r) => (
                <Link to={`/staff/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                  {attr(r, 'name') || attr(r, 'identifier') || '—'}
                </Link>
              ),
            },
            { key: 'identifier', label: 'Username' },
            { key: 'role', label: 'Role' },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) => (
            <button
              onClick={() => setEditing(r)}
              className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Edit
            </button>
          )}
        />
      )}

      {inviting && (
        <Modal title="Invite staff member" onClose={() => setInviting(false)}>
          <ResourceForm
            fields={[
              { name: 'email', label: 'Email', required: true },
              { name: 'name', label: 'Name', required: true },
              { name: 'role', help: 'Controls what this person can do: owner, manager, or staff.', label: 'Role', type: 'select', required: true, options: roleOptions },
              { name: 'venue_id', label: 'Venue assignment', type: 'select', options: venueOptions },
            ]}
            submitLabel="Send invite"
            busy={busy}
            onCancel={() => setInviting(false)}
            onSubmit={async (attrs) => {
              setBusy(true);
              try {
                await api.create('/staff/invite', 'staff-invites', attrs);
                setInviting(false);
                await reload();
              } finally {
                setBusy(false);
              }
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${attr(editing, 'name') || 'staff member'}`} onClose={() => setEditing(null)}>
          <ResourceForm
            initial={editing}
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'role', label: 'Role', type: 'select', options: roleOptions },
              {
                name: 'status',
                label: 'Status',
                type: 'select',
                options: [
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                ],
              },
              { name: 'venue_id', label: 'Venue assignment', type: 'select', options: venueOptions },
            ]}
            submitLabel="Save"
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={async (attrs) => {
              setBusy(true);
              try {
                await api.update(`/staff/${editing.id}`, 'staff', attrs);
                setEditing(null);
                await reload();
              } finally {
                setBusy(false);
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
