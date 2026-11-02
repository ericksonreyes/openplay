import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi, newIdempotencyKey } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { displayName } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { SlotGrid } from '../components/SlotGrid';
import { Card, ErrorState, Loading, PageHeader } from '../components/ui';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ConsentDoc {
  id: string;
  kind: 'facility-rules' | 'waivers';
  label: string;
}

/** Extract consent requirements the API may attach to a created hold/reservation. */
function extractConsents(resource: JsonApiResource | null): ConsentDoc[] {
  if (!resource) return [];
  const docs: ConsentDoc[] = [];
  const push = (value: unknown, kind: ConsentDoc['kind']) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item === 'string') docs.push({ id: item, kind, label: `${kind} ${item}` });
      else if (item && typeof item === 'object' && 'id' in item) {
        const doc = item as { id: string; attributes?: { name?: string; title?: string } };
        docs.push({
          id: doc.id,
          kind,
          label: doc.attributes?.name ?? doc.attributes?.title ?? `${kind} ${doc.id}`,
        });
      }
    }
  };
  push(resource.attributes['facility_rules'], 'facility-rules');
  push(resource.attributes['waivers'], 'waivers');
  push(resource.attributes['waiver_documents'], 'waivers');
  push(resource.attributes['required_consents'], 'facility-rules');
  return docs;
}

export function BookPage() {
  const { venueId = '' } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState<JsonApiResource | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consents, setConsents] = useState<ConsentDoc[]>([]);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const venue = useQuery<JsonApiResource>(
    (t) => jsonApi<JsonApiResource>(`/venues/${venueId}`, { token: t }),
    [venueId],
  );
  const availability = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>(`/venues/${venueId}/availability?date=${date}`, { token: t }),
    [venueId, date],
  );

  async function createReservation(): Promise<JsonApiResource | null> {
    const attributes: Record<string, unknown> = {
      venue_id: venueId,
      date,
      slot_id: slot?.id,
      ...(notes ? { notes } : {}),
    };
    return jsonApi<JsonApiResource>('/reservations', {
      method: 'POST',
      token,
      idempotencyKey: newIdempotencyKey(),
      body: envelope('reservations', attributes),
    });
  }

  async function onBook() {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const reservation = await createReservation();
      const required = extractConsents(reservation);
      if (required.length > 0 && acknowledged.size === 0) {
        // API signaled consent requirements — surface them before finishing.
        setConsents(required);
        setSlot(null);
        return;
      }
      navigate(`/reservations/${reservation?.id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onAcknowledge(doc: ConsentDoc) {
    try {
      const path =
        doc.kind === 'waivers' ? `/waivers/${doc.id}/sign` : `/facility-rules/${doc.id}/acknowledge`;
      await jsonApi(path, { method: 'POST', token, body: envelope(doc.kind, {}) });
      setAcknowledged((prev) => new Set(prev).add(`${doc.kind}:${doc.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consent recording failed.');
    }
  }

  const allDone = consents.every((c) => acknowledged.has(`${c.kind}:${c.id}`));

  if (venue.loading) return <Loading />;
  if (venue.error) return <ErrorState message={venue.error} onRetry={venue.reload} />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={`Book — ${displayName(venue.data, 'Venue')}`} description="Pick a date and time slot to hold a reservation." />
      {error && <ErrorState message={error} />}

      {consents.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-800">Required consents</h2>
          <p className="mb-4 text-sm text-slate-600">
            This venue requires the following before your reservation can be confirmed.
          </p>
          <ul className="space-y-3">
            {consents.map((doc) => {
              const key = `${doc.kind}:${doc.id}`;
              const done = acknowledged.has(key);
              return (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-800">{doc.label}</span>
                  <button
                    onClick={() => onAcknowledge(doc)}
                    disabled={done}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                      done
                        ? 'bg-green-100 text-green-800'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {done ? 'Signed' : doc.kind === 'waivers' ? 'Sign waiver' : 'Acknowledge'}
                  </button>
                </li>
              );
            })}
          </ul>
          {allDone && (
            <Link
              to="/reservations"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Continue to reservations
            </Link>
          )}
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Date</span>
              <input
                type="date"
                value={date}
                min={today()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">Available slots</span>
              {availability.loading ? (
                <Loading />
              ) : availability.error ? (
                <ErrorState message={availability.error} onRetry={availability.reload} />
              ) : (
                <SlotGrid slots={availability.data ?? []} selected={slot} onSelect={setSlot} />
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <button
              onClick={onBook}
              disabled={!slot || busy}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Reserving…' : 'Reserve slot'}
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
