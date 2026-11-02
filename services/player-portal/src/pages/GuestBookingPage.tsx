import { useState } from 'react';
import type { FormEvent } from 'react';
import { envelope, jsonApi, newIdempotencyKey } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { Card, ErrorState, PageHeader } from '../components/ui';

/**
 * No-account booking flow (public):
 * 1. POST /guest-bookings with contact + slot details → returns a booking id.
 * 2. POST /guest-bookings/:id/verify with the code sent to the contact.
 */
export function GuestBookingPage() {
  const [venueId, setVenueId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const booking = await jsonApi<JsonApiResource>('/guest-bookings', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: envelope('guest-bookings', {
          venue_id: venueId,
          date,
          slot_id: slotId,
          name,
          contact,
        }),
      });
      setBookingId(booking?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest booking failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    try {
      await jsonApi(`/guest-bookings/${bookingId}/verify`, {
        method: 'POST',
        body: envelope('verifications', { code }),
      });
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-md border border-slate-300 px-3 py-2';
  const label = 'mb-1 block font-medium text-slate-700';

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Book as guest" description="Book without an account — verify by email or phone." />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {verified ? (
        <Card>
          <p className="font-medium text-green-800">Booking verified.</p>
          <p className="mt-1 text-sm text-slate-600">
            Your guest booking is confirmed. Keep your booking reference: {bookingId}
          </p>
        </Card>
      ) : bookingId ? (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-800">Verify your contact</h2>
          <p className="mb-4 text-sm text-slate-600">
            We sent a verification code to your contact. Enter it to confirm the booking.
          </p>
          <form onSubmit={onVerify} className="space-y-4">
            <label className="block text-sm">
              <span className={label}>Verification code</span>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={input}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify booking'}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className={label}>Venue ID</span>
              <input
                type="text"
                required
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              <span className={label}>Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              <span className={label}>Slot ID</span>
              <input
                type="text"
                required
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              <span className={label}>Your name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              <span className={label}>Email or phone</span>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={input}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Continue'}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
