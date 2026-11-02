import { useEffect, useState } from 'react';

type State = 'loading' | 'ok' | 'down';

export function BackendStatus({ always = false }: { always?: boolean }) {
  const [state, setState] = useState<State>('loading');
  const api = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    fetch(`${api}/api/v1/public/status`)
      .then((r) => (r.ok ? setState('ok') : setState('down')))
      .catch(() => setState('down'));
  }, [api]);

  // Healthy is the default — chrome surfaces the indicator only when the
  // backend is down; pass `always` where the status itself is the content
  // (Platform status page, sign-in).
  if (!always && state !== 'down') return null;

  const label = { loading: 'checking…', ok: 'connected', down: 'unreachable' }[state];
  const color = { loading: 'bg-yellow-400', ok: 'bg-green-500', down: 'bg-red-500' }[state];

  return (
    <span className={`inline-flex items-center gap-2 text-sm ${state === 'down' ? 'text-red-600' : 'text-slate-600'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      backend {label}
    </span>
  );
}
