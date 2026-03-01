/**
 * Displays a golf score with color coding:
 * negative = red (under par), zero = gray (even), positive = blue (over par)
 * CUT/WD = gray strikethrough
 */
export default function ScoreTag({ score, raw }) {
  if (raw && ['CUT', 'WD', 'DQ', 'MDF'].includes(String(raw).toUpperCase())) {
    return (
      <span className="text-gray-400 text-sm line-through font-mono">{raw}</span>
    );
  }

  const n = typeof score === 'number' ? score : parseInt(score, 10);
  if (isNaN(n)) {
    return <span className="text-gray-400 text-sm font-mono">{raw ?? 'N/A'}</span>;
  }

  if (n < 0) {
    return (
      <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-semibold font-mono text-sm">
        {String(n)}
      </span>
    );
  }

  if (n > 0) {
    return (
      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-mono text-sm">
        +{n}
      </span>
    );
  }

  return (
    <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono text-sm">
      E
    </span>
  );
}
