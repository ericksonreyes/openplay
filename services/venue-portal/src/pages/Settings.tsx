import { useEffect, useState } from 'react';
import { api, attr, type Resource } from '../lib/api';
import { ResourceForm } from '../components/CrudPage';
import { ErrorState, PageHeader, Spinner } from '../components/ui';

const fields = [
  { name: 'name', label: 'Business name', required: true },
  { name: 'description', label: 'Description', type: 'textarea' as const },
  { name: 'contact_email', label: 'Contact email' },
  { name: 'contact_phone', label: 'Contact phone' },
  { name: 'website', label: 'Website' },
  { name: 'timezone', label: 'Timezone', placeholder: 'Asia/Manila' },
];

export function SettingsPage() {
  const [tenant, setTenant] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get('/tenants/current')
      .then(setTenant)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings.'));
  }, []);

  async function save(attrs: Record<string, unknown>) {
    setBusy(true);
    setSaved(false);
    try {
      const updated = await api.update('/tenants/current', 'tenants', attrs);
      setTenant(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Business settings" />
      {error && <ErrorState message={error} />}
      {tenant === null && !error ? (
        <Spinner />
      ) : tenant ? (
        <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
          {saved && (
            <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">Settings saved.</p>
          )}
          <p className="mb-4 text-xs text-slate-500">
            Tenant code: <span className="font-mono">{attr(tenant, 'code') || '—'}</span>
          </p>
          <ResourceForm
            fields={fields}
            initial={tenant}
            submitLabel="Save settings"
            busy={busy}
            onSubmit={save}
            onCancel={() => undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
