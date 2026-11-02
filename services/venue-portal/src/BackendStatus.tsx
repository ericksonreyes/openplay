import { useEffect, useState } from 'react';

type State = 'loading' | 'ok' | 'down';

export function BackendStatus() {
  const [state, setState] = useState<State>('loading');
  const api = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    fetch(`${api}/api/v1/public/status`)
      .then((r) => (r.ok ? setState('ok') : setState('down')))
      .catch(() => setState('down'));
  }, [api]);

  // Silent when healthy — the indicator only exists to flag trouble.
  if (state !== 'down') return null;

  return (
    <span className="inline-flex items-center gap-2 text-sm text-red-600">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      backend unreachable
    </span>
  );
}
