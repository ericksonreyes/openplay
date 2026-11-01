'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AvailabilityPicker({
  venueId,
  initialDate,
}: {
  venueId: string;
  initialDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (date) router.push(`/venues/${venueId}?date=${date}`);
      }}
    >
      <label className="text-sm font-medium text-slate-700">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Check availability
      </button>
    </form>
  );
}
