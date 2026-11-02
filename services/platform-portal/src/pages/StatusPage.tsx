import { useEffect, useState } from 'react';
import { API_ROOT, platformPing } from '../lib/api';
import { BackendStatus } from '../BackendStatus';
import { PageHeader } from '../components/ui';

type PingState = 'loading' | 'ok' | 'failed';

export function StatusPage() {
  const [ping, setPing] = useState<PingState>('loading');
  const [pingDetail, setPingDetail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    platformPing()
      .then((data) => {
        if (cancelled) return;
        setPing(data.attributes.ok ? 'ok' : 'failed');
        setPingDetail(data.attributes.ok ? 'platform.tenants.manage granted' : 'unexpected response');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setPing('failed');
        setPingDetail(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pingColor = { loading: 'bg-yellow-400', ok: 'bg-green-500', failed: 'bg-red-500' }[ping];
  const pingLabel = { loading: 'checking…', ok: 'ok', failed: 'failed' }[ping];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform status"
        description="Live health of the backend and connected services."
      />

      <div className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Backend API</p>
            <p className="text-xs text-slate-500">{API_ROOT}/api/v1/public/status</p>
          </div>
          <BackendStatus always />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Platform ping</p>
            <p className="text-xs text-slate-500">
              GET /api/v1/platform/ping (permission-gated){pingDetail ? ` — ${pingDetail}` : ''}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${pingColor}`} />
            {pingLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
