const STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  awaiting_review: 'bg-amber-100 text-amber-800',
  setup: 'bg-slate-100 text-slate-700',
  suspended: 'bg-red-100 text-red-800',
};

const LABELS: Record<string, string> = {
  awaiting_review: 'Awaiting review',
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {statusLabel(status)}
    </span>
  );
}
