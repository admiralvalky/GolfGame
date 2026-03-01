import { useState, useEffect, useCallback } from 'react';

/**
 * Polls a fetch function every `intervalMs` milliseconds.
 * Returns { data, loading, error, lastUpdated, refresh }
 */
export function useAutoRefresh(fetchFn, intervalMs = 10 * 60 * 1000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message ?? 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);

  return { data, loading, error, lastUpdated, refresh };
}
