import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/toast';

interface SettingsResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

type State = 'loading' | 'unavailable' | 'ready';

export function SettingsPage() {
  const { notify } = useToast();
  const [state, setState] = useState<State>('loading');
  const [settings, setSettings] = useState<SettingsResource | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<SettingsResource>('/platform/settings')
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setState('ready');
      })
      .catch(() => {
        // Endpoint is planned (🚧) — show an honest coming-soon state.
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      const updated = await apiFetch<SettingsResource>('/platform/settings', {
        method: 'PATCH',
        type: settings.type,
        attributes: settings.attributes,
      });
      setSettings(updated);
      notify('Settings saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Save failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Platform settings</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">Platform-wide configuration values.</p>

      {state === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}

      {state === 'unavailable' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Coming soon</h2>
          <p className="mt-2 text-sm text-slate-600">
            The platform settings endpoint (<code className="rounded bg-slate-100 px-1">GET/PATCH /api/v1/platform/settings</code>)
            is planned but not implemented in the backend yet. Once it ships, this
            page will manage platform-wide configuration here.
          </p>
        </div>
      )}

      {state === 'ready' && settings && (
        <form
          onSubmit={onSubmit}
          className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        >
          {Object.entries(settings.attributes).map(([key, value]) => (
            <div key={key}>
              <label htmlFor={`setting-${key}`} className="block text-sm font-medium text-slate-700">
                {key.replace(/_/g, ' ')}
              </label>
              <input
                id={`setting-${key}`}
                type="text"
                value={String(value ?? '')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    attributes: { ...settings.attributes, [key]: e.target.value },
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
    </div>
  );
}
