// Shared grid layout — imported by HybridTeamRow for the column header row.
// Dividers are NOT in this grid; they are absolutely positioned on the container in HybridTeamRow.
export const PLAYER_GRID_COLS = '1.5rem 1fr 1.75rem 2rem 2rem 2rem 2rem 2.5rem';

function parseScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toUpperCase();
  if (s === 'E') return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function nonCountingColor(val) {
  const n = parseScore(val);
  if (n === null) return 'text-pool-faint';
  if (n > 0) return 'text-pool-over';
  if (n < 0) return 'text-pool-secondary';
  return 'text-pool-even';
}

function totalColor(val) {
  if (val === null || val === undefined) return 'text-pool-faint';
  if (val === 0) return 'text-pool-even';
  if (val < 0) return 'text-pool-under';
  if (val > 0) return 'text-pool-over';
  return 'text-pool-faint';
}

function formatTotal(val) {
  if (val === null || val === undefined) return '—';
  if (val === 0) return 'E';
  if (val > 0) return `+${val}`;
  return String(val);
}

export default function PlayerInlineRow({
  pos,
  name,
  thru,
  rounds = [null, null, null, null],
  countingRounds = [false, false, false, false],
  total,
  isCut = false,
}) {
  return (
    <div
      className={`bg-pool-elevated px-3 py-2${isCut ? ' opacity-40' : ''}`}
      style={{ display: 'grid', gridTemplateColumns: PLAYER_GRID_COLS, alignItems: 'center', gap: '0' }}
    >
      {/* Position — block ensures the span fills its grid cell so text-center works */}
      <span className="block text-[10px] text-pool-muted text-center">{pos}</span>

      {/* Player name */}
      <span className={`text-sm font-medium min-w-0 truncate pr-2${isCut ? ' line-through text-pool-muted' : ' text-pool-primary'}`}>
        {name}
      </span>

      {/* Thru */}
      <span className="block text-[10px] text-pool-muted text-center">{thru ?? '—'}</span>

      {/* Round scores R1–R4 */}
      {rounds.map((score, i) => {
        const isCounting = countingRounds[i] === true;
        const hasScore = score !== null && score !== undefined && String(score).trim() !== '';

        if (isCounting && hasScore) {
          return (
            <span key={i} className="flex items-center justify-center">
              <span className="text-xs font-mono font-bold bg-pool-counting text-pool-counting-fg rounded px-1 py-0.5 leading-none">
                {score}
              </span>
            </span>
          );
        }

        return (
          <span key={i} className={`block text-xs font-mono text-center ${hasScore ? nonCountingColor(score) : 'text-pool-faint'}`}>
            {hasScore ? score : '—'}
          </span>
        );
      })}

      {/* Total */}
      <span className={`block text-sm font-mono font-bold text-right ${totalColor(total)}`}>
        {formatTotal(total)}
      </span>
    </div>
  );
}
