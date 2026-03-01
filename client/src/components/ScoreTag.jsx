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

  let colorClass = 'text-gray-600';
  let label = 'E';
  if (n < 0) {
    colorClass = 'text-red-600 font-semibold';
    label = String(n);
  } else if (n > 0) {
    colorClass = 'text-blue-600';
    label = `+${n}`;
  }

  return <span className={`font-mono text-sm ${colorClass}`}>{label}</span>;
}
