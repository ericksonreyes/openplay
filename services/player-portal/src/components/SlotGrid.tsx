import type { JsonApiResource } from '../lib/api';
import { attr, attrString, displayName } from '../lib/attrs';

function slotLabel(slot: JsonApiResource): string {
  const start = attrString(slot, 'starts_at', 'start', 'start_time', 'time', 'label');
  const end = attrString(slot, 'ends_at', 'end', 'end_time');
  if (start && end) return `${start} – ${end}`;
  return start || displayName(slot, 'Slot');
}

function isAvailable(slot: JsonApiResource): boolean {
  const status = String(attr(slot, 'status') ?? 'available').toLowerCase();
  const available = attr(slot, 'available', 'bookable');
  if (typeof available === 'boolean') return available;
  return !['booked', 'unavailable', 'closed', 'blocked', 'held'].includes(status);
}

export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: JsonApiResource[];
  selected: JsonApiResource | null;
  onSelect: (slot: JsonApiResource) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-slate-500">No slots published for this date.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="listbox">
      {slots.map((slot) => {
        const available = isAvailable(slot);
        const isSelected = selected?.id === slot.id;
        return (
          <button
            key={slot.id}
            type="button"
            disabled={!available}
            onClick={() => onSelect(slot)}
            className={`rounded-md border px-3 py-2 text-sm ${
              isSelected
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : available
                  ? 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            {slotLabel(slot)}
          </button>
        );
      })}
    </div>
  );
}
