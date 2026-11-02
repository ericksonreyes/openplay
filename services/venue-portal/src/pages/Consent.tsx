import { useEffect, useState } from 'react';
import { attr } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { ErrorState, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';
import { formatDateTime } from '../lib/format';

export function RuleAcknowledgmentsPage() {
  const { rows: rules } = useList('/facility-rules');
  const [ruleId, setRuleId] = useState('');

  useEffect(() => {
    if (!ruleId && rules?.length) setRuleId(rules[0].id);
  }, [rules, ruleId]);

  const acks = useList(`/facility-rules/${ruleId}/acknowledgments`, undefined, Boolean(ruleId));

  return (
    <div>
      <PageHeader title="Rule acknowledgments"
        description="Who acknowledged each facility rule, and when." />
      {acks.error && <div className="mb-4"><ErrorState message={acks.error} onRetry={acks.reload} /></div>}
      {ruleId && acks.rows === null && !acks.error ? (
        <Spinner />
      ) : (
        <DataTable
          toolbar={
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
          }
          emptyMessage={ruleId ? 'No acknowledgments recorded.' : 'Pick a facility rule to see who acknowledged it.'}
          columns={[
            { key: 'user', label: 'User', render: (r) => attr(r, 'user_name') || attr(r, 'player_name') || '—' },
            { key: 'acknowledged_at', label: 'Acknowledged at', render: (r) => formatDateTime(attr(r, 'acknowledged_at') || attr(r, 'created_at')) },
          ]}
          rows={ruleId ? (acks.rows ?? []) : []}
        />
      )}
    </div>
  );
}

export function WaiverSignaturesPage() {
  const { rows: waivers } = useList('/waiver-documents');
  const [waiverId, setWaiverId] = useState('');

  useEffect(() => {
    if (!waiverId && waivers?.length) setWaiverId(waivers[0].id);
  }, [waivers, waiverId]);

  const sigs = useList(`/waiver-documents/${waiverId}/signatures`, undefined, Boolean(waiverId));

  return (
    <div>
      <PageHeader title="Waiver signatures"
        description="Who signed each waiver document, and when." />
      {sigs.error && <div className="mb-4"><ErrorState message={sigs.error} onRetry={sigs.reload} /></div>}
      {waiverId && sigs.rows === null && !sigs.error ? (
        <Spinner />
      ) : (
        <DataTable
          toolbar={
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
          }
          emptyMessage={waiverId ? 'No signatures recorded.' : 'Pick a waiver document to see signatures.'}
          columns={[
            { key: 'user', label: 'Signer', render: (r) => attr(r, 'user_name') || attr(r, 'signer_name') || '—' },
            { key: 'signed_at', label: 'Signed at', render: (r) => formatDateTime(attr(r, 'signed_at') || attr(r, 'created_at')) },
            statusColumn(),
          ]}
          rows={waiverId ? (sigs.rows ?? []) : []}
        />
      )}
    </div>
  );
}
