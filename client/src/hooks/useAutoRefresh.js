import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Polls a fetch function every `intervalMs` milliseconds.
 * Returns { data, loading, error, lastUpdated, refresh }
 */
export function useAutoRefresh(fetchFn, intervalMs = 10 * 60 * 1000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await fetchFn();
      if (requestId !== requestIdRef.current) return;
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.response?.data?.error ?? err.message ?? 'Failed to fetch data');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (intervalMs === null) return;
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);

  return { data, loading, error, lastUpdated, refresh };
}
