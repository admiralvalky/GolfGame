const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);

export default function ScoreTag({ score, raw }) {
  if (raw && CUT_STATUSES.has(String(raw).toUpperCase())) {
    return (
      <span className="text-pool-faint text-sm line-through font-mono">{raw}</span>
    );
  }

  const n = typeof score === 'number' ? score : parseInt(score, 10);
  if (isNaN(n)) {
    return <span className="text-pool-faint text-sm font-mono">{raw ?? 'N/A'}</span>;
  }

  if (n < 0) {
    return (
      <span className="bg-green-900/50 text-pool-under border border-green-800 px-1.5 py-0.5 rounded font-semibold font-mono text-sm">
        {String(n)}
      </span>
    );
  }

  if (n > 0) {
    return (
      <span className="bg-red-900/40 text-pool-over border border-red-900 px-1.5 py-0.5 rounded font-mono text-sm">
        +{n}
      </span>
    );
  }

  return (
    <span className="bg-pool-elevated text-pool-even border border-pool-rim px-1.5 py-0.5 rounded font-mono text-sm">
      E
    </span>
  );
}
