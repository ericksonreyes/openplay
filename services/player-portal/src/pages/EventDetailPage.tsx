import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attributeEntries, attr, displayName, attrString } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, DetailTable, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { token } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useQuery<JsonApiResource>(
    (t) => jsonApi<JsonApiResource>(`/events/${id}`, { token: t }),
    [id],
  );

  const registration = attr(data, 'registration', 'my_registration') as
    | { id?: string }
    | string
    | null
    | undefined;
  const registrationId = typeof registration === 'string' ? registration : registration?.id;
  const registered = Boolean(registrationId) || Boolean(attr(data, 'registered'));

  async function onRegister() {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await jsonApi(`/events/${id}/register`, {
        method: 'POST',
        token,
        body: envelope('registrations', { event_id: id }),
      });
      setNotice('You are registered for this event.');
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onUnregister() {
    if (!registrationId) {
      setActionError('Registration record not found on this event.');
      return;
    }
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await jsonApi(`/registrations/${registrationId}`, { method: 'DELETE', token });
      setNotice('Registration cancelled.');
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const status = attrString(data, 'status');

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={displayName(data, 'Event')} description="Event details and registration.">
        {status && <StatusBadge status={status} />}
      </PageHeader>
      {actionError && <ErrorState message={actionError} />}
      {notice && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      <Card>
        <DetailTable rows={attributeEntries(data, ['name', 'title', 'registration', 'my_registration', 'registered'])} />
      </Card>

      {registered ? (
        <button
          onClick={onUnregister}
          disabled={busy}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel registration
        </button>
      ) : (
        <button
          onClick={onRegister}
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Registering…' : 'Register'}
        </button>
      )}
    </div>
  );
}
