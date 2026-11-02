import { useCallback, useEffect, useState } from 'react';
import { api, type Resource } from './api';

export function useList(
  path: string,
  params?: Record<string, string | undefined>,
  enabled = true,
) {
  const [rows, setRows] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});
  const reload = useCallback(async () => {
    if (!enabled) {
      setRows(null);
      return;
    }
    setError(null);
    try {
      setRows(await api.list(path, JSON.parse(paramsKey)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
      setRows([]);
    }
  }, [path, paramsKey, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, error, reload };
}

/** useList + server-side table controls (sort, filter[q], filter[from], filter[to]).
 *  Pass the returned `server` to <DataTable server={server} />. */
export function useServerTable(
  path: string,
  baseParams?: Record<string, string | undefined>,
  enabled = true,
) {
  const [ctl, setCtl] = useState<Record<string, string | undefined>>({});
  const { rows, error, reload } = useList(
    path,
    { ...baseParams, ...ctl },
    enabled,
  );
  const server = useCallback(
    (c: { sort?: string; from?: string; to?: string; q?: string }) =>
      setCtl({
        sort: c.sort,
        'filter[from]': c.from,
        'filter[to]': c.to,
        'filter[q]': c.q,
      }),
    [],
  );
  return { rows, error, reload, server };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Per-page persisted view preference (localStorage, scoped by key). */
export function usePersistedView<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [view, setView] = useState<T>(() => {
    try {
      return (localStorage.getItem(`view:${key}`) as T) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const set = (v: T) => {
    setView(v);
    try {
      localStorage.setItem(`view:${key}`, v);
    } catch {}
  };
  return [view, set];
}
