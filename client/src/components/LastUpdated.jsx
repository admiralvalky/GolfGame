export default function LastUpdated({ timestamp, onRefresh, loading }) {
  if (!timestamp) return null;

  const formatted = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Updated {formatted}</span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="text-golf-green hover:text-golf-dark disabled:opacity-50 underline"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      <span className="text-gray-300">(auto every 10 min)</span>
    </div>
  );
}
