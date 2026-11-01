import type { AvailabilitySlot } from '../lib/types';

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isAvailable(slot: AvailabilitySlot): boolean {
  if (typeof slot.available === 'boolean') return slot.available;
  return (slot.status ?? 'available').toLowerCase() === 'available';
}

export function SlotGrid({ slots }: { slots: AvailabilitySlot[] }) {
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No slots published for this date.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="list">
      {slots.map((slot, i) => {
        const available = isAvailable(slot);
        const label = `${fmtTime(slot.starts_at ?? slot.start)} – ${fmtTime(
          slot.ends_at ?? slot.end,
        )}`;
        return (
          <li
            key={i}
            className={`rounded-md border px-3 py-2 text-center text-sm ${
              available
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-slate-200 bg-slate-100 text-slate-400 line-through'
            }`}
            aria-label={`${label} ${available ? 'available' : 'unavailable'}`}
          >
            {label}
            {slot.resource_name && (
              <span className="block text-xs">{slot.resource_name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
