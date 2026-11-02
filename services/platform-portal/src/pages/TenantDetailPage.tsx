import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getTenant, transitionTenant } from '../lib/api';
import type { TenantResource } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/toast';

type Action = 'approve' | 'suspend' | 'restore';

const ACTIONS: Record<Action, { label: string; title: string; reasonRequired: boolean; allowed: string[] }> = {
  approve: {
    label: 'Approve',
    title: 'Approve tenant',
    reasonRequired: false,
    allowed: ['setup', 'awaiting_review'],
  },
  suspend: {
    label: 'Suspend',
    title: 'Suspend tenant',
    reasonRequired: true,
    allowed: ['active'],
  },
  restore: {
    label: 'Restore',
    title: 'Restore tenant',
    reasonRequired: false,
    allowed: ['suspended'],
  },
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const { notify } = useToast();
  const [tenant, setTenant] = useState<TenantResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getTenant(id)
      .then(setTenant)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);

  const openAction = (a: Action) => {
    setReason('');
    setPurpose('');
    setFormError(null);
    setAction(a);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;
    const spec = ACTIONS[action];
    if (spec.reasonRequired && !reason.trim()) {
      setFormError('A reason is required to suspend a tenant.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const updated = await transitionTenant(id, action, { reason, purpose });
      setTenant(updated);
      setAction(null);
      notify(`Tenant ${action === 'approve' ? 'approved' : action === 'suspend' ? 'suspended' : 'restored'}.`, 'success');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Action failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">
          ← Back to tenants
        </Link>
        <p role="alert" className="flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-xs font-medium underline">Dismiss</button>
        </p>
      </div>
    );
  }
  if (!tenant) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const a = tenant.attributes;
  const app = a.application;
  const available = (Object.keys(ACTIONS) as Action[]).filter((k) =>
    ACTIONS[k].allowed.includes(a.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">
            ← Back to tenants
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold text-slate-900">
            {a.name}
            <StatusBadge status={a.status} />
          </h1>
          <p className="mt-1 max-w-prose text-sm text-slate-500">Full application details for this business, with review actions.</p>
        </div>
        {available.length > 0 && (
          <div className="flex justify-end gap-3">
            {available.map((k) => (
              <button
                key={k}
                onClick={() => openAction(k)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  k === 'suspend'
                    ? 'border border-red-300 text-red-700 hover:bg-red-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {ACTIONS[k].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Business</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Name" value={a.name} />
          <Field label="Code" value={a.code} />
          <Field label="Published" value={a.published ? 'Yes' : 'No'} />
          <Field label="Submitted" value={formatDate(a.created_at)} />
          <Field label="Last updated" value={formatDate(a.updated_at)} />
          <Field label="Tenant ID" value={tenant.id} />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Application</h2>
        {app ? (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Owner name" value={app.owner_name} />
            <Field label="Owner email" value={app.owner_email} />
            <Field label="Applied" value={formatDate(app.submitted_at)} />
            {app.message && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Message
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{app.message}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No onboarding application on record.</p>
        )}
      </section>

      <Modal title={action ? ACTIONS[action].title : ''} open={action !== null} onClose={() => !busy && setAction(null)}>
        {action && (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              {action === 'approve' && `Approve ${a.name} and activate the tenant?`}
              {action === 'suspend' && `Suspend ${a.name}? The tenant's venues stop accepting bookings.`}
              {action === 'restore' && `Restore ${a.name} to active?`}
            </p>
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-slate-700">
                Reason {ACTIONS[action].reasonRequired ? '(required)' : '(optional)'}
              </label>
              <textarea
                id="reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-slate-700">
                Audit purpose (optional)
              </label>
              <input
                id="purpose"
                type="text"
                maxLength={500}
                placeholder="e.g. support ticket 42"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {formError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  action === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {busy ? 'Working…' : `Confirm ${ACTIONS[action].label.toLowerCase()}`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
