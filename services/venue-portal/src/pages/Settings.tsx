import { useEffect, useMemo, useState } from 'react';
import { api, attr, type Resource } from '../lib/api';
import { ResourceForm } from '../components/CrudPage';
import { Link } from 'react-router-dom';
import { ErrorState, PageHeader, Spinner } from '../components/ui';
import { countries, DEFAULT_COUNTRY, ianaTimezones, setDisplayTimeZone } from '../lib/format';

/** Tenant profile fields live inside the `details` JSONB object. */
function detail(t: Resource, key: string): string {
  const d = t.attributes?.details as Record<string, unknown> | undefined;
  const v = d?.[key];
  return typeof v === 'string' ? v : '';
}

export function SettingsPage() {
  const [tenant, setTenant] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const tzOptions = useMemo(ianaTimezones, []);

  const fields = [
    { name: 'name', label: 'Business name', required: true },
    { name: 'description', label: 'Description', type: 'textarea' as const },
    { name: 'contact_email', label: 'Contact email' },
    { name: 'contact_phone', label: 'Contact phone' },
    { name: 'website', label: 'Website' },
    { name: 'address.line1', label: 'Address line 1' },
    { name: 'address.line2', label: 'Address line 2' },
    { name: 'address.city', label: 'City' },
    { name: 'address.region', label: 'Region / State' },
    { name: 'address.country', label: 'Country', type: 'select' as const, defaultValue: DEFAULT_COUNTRY, options: countries() },
    {
      name: 'timezone',
      label: 'Timezone',
      type: 'select' as const,
      required: true,
      options: tzOptions,
      help: 'Times across the portal are shown in this zone.',
    },
  ];

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
      const { name, ...details } = attrs;
      const updated = await api.update('/tenants/current', 'tenants', { name, details });
      setTenant(updated);
      setDisplayTimeZone(detail(updated, 'timezone'));
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Business settings" description="Your business profile shown on the public site and booking confirmations." />
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
            initial={{
              ...tenant,
              attributes: {
                ...tenant.attributes,
                ...(tenant.attributes?.details as Record<string, unknown> | undefined),
              },
            }}
            submitLabel="Save settings"
            busy={busy}
            onSubmit={save}
            onCancel={() => undefined}
          />
        </div>
      ) : null}
      {tenant && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/tenant/${tenant.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
