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

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
