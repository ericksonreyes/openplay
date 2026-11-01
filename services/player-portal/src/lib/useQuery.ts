import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from './api';
import { useAuth } from '../auth/AuthContext';

interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Minimal data-fetching hook. Runs `fetcher` on mount and when `deps` change.
 * On a 401 the session token is cleared and the user is sent to /sign-in.
 */
export function useQuery<T>(fetcher: (token: string | null) => Promise<T>, deps: unknown[] = []) {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current(token)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          signOut();
          navigate('/sign-in', { replace: true });
          return;
        }
        setState({
          data: null,
          error: err instanceof Error ? err.message : 'Something went wrong.',
          loading: false,
        });
      });
  }, [token, signOut, navigate, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
