/** Shared display formatting — never show raw ISO timestamps in UI tables. */
export function formatDateTime(iso: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function formatSlot(start: string, end: string): string {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || Number.isNaN(s.getTime())) return '—';
  const date = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (!e || Number.isNaN(e.getTime())) return `${date} · ${time}`;
  return `${date} · ${time}–${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Money is integer minor units (centavos) — render with the ISO currency. */
export function formatMoney(cents: unknown, currency: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  const cur = typeof currency === 'string' && currency ? currency : 'PHP';
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: cur }).format(n / 100);
}
