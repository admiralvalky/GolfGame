import { useState } from 'react';

export default function LastUpdated({ timestamp, onRefresh, loading }) {
  const [cooldownActive, setCooldownActive] = useState(false);
  const [showToast, setShowToast] = useState(false);

  if (!timestamp) return null;

  const formatted = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  async function handleRefresh() {
    setCooldownActive(true);
    setTimeout(() => setCooldownActive(false), 5000);
    await onRefresh();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 text-xs text-pool-muted">
      <span>Updated {formatted}</span>
      <button
        onClick={handleRefresh}
        disabled={loading || cooldownActive}
        className="text-pool-secondary hover:text-pool-primary disabled:opacity-40 underline"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      {showToast ? (
        <span className="text-pool-under font-medium">Scores refreshed</span>
      ) : (
        <span className="text-pool-faint">(auto every 10 min)</span>
      )}
    </div>
  );
}
