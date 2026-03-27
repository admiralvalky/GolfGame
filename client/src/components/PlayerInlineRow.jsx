// Shared grid layout — imported by HybridTeamRow for the column header row.
// The two 1px columns are vertical dividers rendered as full-height spans.
export const PLAYER_GRID_COLS = '1.5rem 1fr 1.75rem 1px 2rem 2rem 2rem 2rem 1px 2.5rem';
export const DIVIDER = { alignSelf: 'stretch', background: 'rgba(45,90,61,0.22)' };

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
  if (n > 0) return 'text-pool-over'; // red for over-par
  if (n < 0) return 'text-pool-secondary'; // subtle for under-par
  return 'text-pool-even'; // gray for even
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
      {/* Position */}
      <span className="text-[10px] text-pool-muted text-center">{pos}</span>

      {/* Player name */}
      <span className={`text-sm font-medium min-w-0 truncate pr-2${isCut ? ' line-through text-pool-muted' : ' text-pool-primary'}`}>
        {name}
      </span>

      {/* Thru */}
      <span className="text-[10px] text-pool-muted text-center">{thru ?? '—'}</span>

      {/* Divider — spans full row height as a grid column item */}
      <span style={DIVIDER} />

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
          <span key={i} className={`text-xs font-mono text-center ${hasScore ? nonCountingColor(score) : 'text-pool-faint'}`}>
            {hasScore ? score : '—'}
          </span>
        );
      })}

      {/* Divider — spans full row height as a grid column item */}
      <span style={DIVIDER} />

      {/* Total */}
      <span className={`text-sm font-mono font-bold text-right pl-1 ${totalColor(total)}`}>
        {formatTotal(total)}
      </span>
    </div>
  );
}
