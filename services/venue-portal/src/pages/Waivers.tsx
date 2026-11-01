import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { CrudPage, ResourceForm, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';

export function WaiversPage() {
  return (
    <CrudPage
      title="Waiver documents"
      path="/waiver-documents"
      type="waiver-documents"
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'id',
          label: 'Versions',
          render: (r) => (
            <Link to={`/catalog/waivers/${r.id}/versions`} className="text-indigo-600 hover:underline">
              Manage versions
            </Link>
          ),
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      emptyMessage="No waiver documents yet."
    />
  );
}

export function WaiverVersionsPage() {
  const { waiverId } = useParams<{ waiverId: string }>();
  const base = `/waiver-documents/${waiverId}`;
  const { rows, error, reload } = useList(`${base}/versions`);
  const [doc, setDoc] = useState<Resource | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api.get(base).then(setDoc).catch(() => setDoc(null));
  }, [base]);

  const runAction = useCallback(
    async (versionId: string, action: 'publish' | 'retire') => {
      setActionError(null);
      try {
        await api.action(`${base}/versions/${versionId}/${action}`);
        await reload();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Action failed.');
      }
    },
    [base, reload],
  );

  return (
    <div>
      <PageHeader title={`Versions — ${attr(doc, 'title') || 'waiver document'}`}>
        <Link to="/catalog/waivers" className="text-sm text-indigo-600 hover:underline">
          Back to waivers
        </Link>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New version
        </button>
      </PageHeader>
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No versions yet. Create the first version of this waiver." />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Version</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Effective</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{attr(v, 'version') || attr(v, 'version_number') || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{attr(v, 'effective_at') ? formatDateTime(attr(v, 'effective_at')) : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{attr(v, 'status') || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {attr(v, 'status') !== 'published' && (
                      <button
                        onClick={() => runAction(v.id, 'publish')}
                        className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Publish
                      </button>
                    )}
                    {attr(v, 'status') === 'published' && (
                      <button
                        onClick={() => runAction(v.id, 'retire')}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Retire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-3 md:hidden">
          {rows.map((v) => (
            <li key={v.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  {attr(v, 'version') || attr(v, 'version_number') || '—'}
                </span>
                <span className="text-sm text-slate-600">{attr(v, 'status') || '—'}</span>
              </div>
              <dl className="mt-2 divide-y divide-slate-100 text-sm">
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Effective</dt>
                  <dd className="text-slate-800">
                    {attr(v, 'effective_at') ? formatDateTime(attr(v, 'effective_at')) : '—'}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 flex justify-end gap-2">
                {attr(v, 'status') !== 'published' && (
                  <button
                    onClick={() => runAction(v.id, 'publish')}
                    className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    Publish
                  </button>
                )}
                {attr(v, 'status') === 'published' && (
                  <button
                    onClick={() => runAction(v.id, 'retire')}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Retire
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
      {creating && (
        <Modal title="New waiver version" onClose={() => setCreating(false)}>
          <ResourceForm
            fields={[
              { name: 'version', label: 'Version label', required: true, placeholder: 'v2' },
              { name: 'body', label: 'Waiver text', type: 'textarea', required: true },
              { name: 'effective_at', label: 'Effective at', type: 'datetime-local' },
            ]}
            submitLabel="Create version"
            busy={busy}
            onCancel={() => setCreating(false)}
            onSubmit={async (attrs) => {
              setBusy(true);
              try {
                await api.create(`${base}/versions`, 'waiver-versions', attrs);
                setCreating(false);
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
