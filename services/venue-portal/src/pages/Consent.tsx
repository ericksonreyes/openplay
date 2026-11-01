import { useState } from 'react';
import { attr } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';

export function ConsentPage() {
  const { rows: rules } = useList('/facility-rules');
  const { rows: waivers } = useList('/waiver-documents');
  const [ruleId, setRuleId] = useState('');
  const [waiverId, setWaiverId] = useState('');

  const acks = useList(`/facility-rules/${ruleId}/acknowledgments`, undefined, Boolean(ruleId));
  const sigs = useList(`/waiver-documents/${waiverId}/signatures`, undefined, Boolean(waiverId));

  return (
    <div>
      <PageHeader title="Consent reporting"
        description="Audit view of rule acknowledgements and waiver signatures across customers." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Rule acknowledgments</h2>
            <select
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Select facility rule"
            >
              <option value="">Select a rule…</option>
              {(rules ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {attr(r, 'title')}
                </option>
              ))}
            </select>
          </div>
          {!ruleId ? (
            <EmptyState message="Pick a facility rule to see who acknowledged it." />
          ) : acks.rows === null ? (
            <Spinner />
          ) : acks.error ? (
            <ErrorState message={acks.error} onRetry={acks.reload} />
          ) : acks.rows.length === 0 ? (
            <EmptyState message="No acknowledgments recorded." />
          ) : (
            <DataTable
              columns={[
                { key: 'user', label: 'User', render: (r) => attr(r, 'user_name') || attr(r, 'player_name') || '—' },
                { key: 'acknowledged_at', label: 'Acknowledged at', render: (r) => formatDateTime(attr(r, 'acknowledged_at') || attr(r, 'created_at')) },
              ]}
              rows={acks.rows}
            />
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Waiver signatures</h2>
            <select
              value={waiverId}
              onChange={(e) => setWaiverId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Select waiver document"
            >
              <option value="">Select a waiver…</option>
              {(waivers ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {attr(r, 'title')}
                </option>
              ))}
            </select>
          </div>
          {!waiverId ? (
            <EmptyState message="Pick a waiver document to see signatures." />
          ) : sigs.rows === null ? (
            <Spinner />
          ) : sigs.error ? (
            <ErrorState message={sigs.error} onRetry={sigs.reload} />
          ) : sigs.rows.length === 0 ? (
            <EmptyState message="No signatures recorded." />
          ) : (
            <DataTable
              columns={[
                { key: 'user', label: 'Signer', render: (r) => attr(r, 'user_name') || attr(r, 'signer_name') || '—' },
                { key: 'signed_at', label: 'Signed at', render: (r) => formatDateTime(attr(r, 'signed_at') || attr(r, 'created_at')) },
                statusColumn(),
              ]}
              rows={sigs.rows}
            />
          )}
        </section>
      </div>
    </div>
  );
}
