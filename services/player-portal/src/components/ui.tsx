import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate-500">Loading…</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  succeeded: 'bg-green-100 text-green-800',
  paid: 'bg-green-100 text-green-800',
  held: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-slate-200 text-slate-600',
  canceled: 'bg-slate-200 text-slate-600',
  declined: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  expired: 'bg-slate-200 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status.toLowerCase()] ?? 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status || 'unknown'}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function ResourceCard({
  to,
  title,
  subtitle,
  status,
  meta,
}: {
  to?: string;
  title: string;
  subtitle?: string;
  status?: string;
  meta?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-slate-900">{title}</h3>
        {status && <StatusBadge status={status} />}
      </div>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      {meta && <p className="mt-2 text-xs text-slate-400">{meta}</p>}
    </>
  );
  if (!to) return <Card>{inner}</Card>;
  return (
    <Link to={to} className="block">
      <Card className="transition hover:border-slate-400">{inner}</Card>
    </Link>
  );
}

export function DetailTable({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return null;
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([key, value]) => (
        <div key={key} className="flex gap-4 py-2 text-sm">
          <dt className="w-40 shrink-0 font-medium capitalize text-slate-500">{key}</dt>
          <dd className="break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
