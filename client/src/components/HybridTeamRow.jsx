import { PLAYER_GRID_COLS } from './PlayerInlineRow.jsx';

// Absolute-positioned divider lines on the expanded container.
// Calculated from the RIGHT edge: right-padding(0.75rem) + fixed column widths.
// Tot divider (between R4 and Tot):  0.75 + 2.5 = 3.25rem
// R1 divider  (between Thru and R1): 0.75 + 2.5 + 2 + 2 + 2 + 2 = 11.25rem
const DIVIDER_STYLE = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '1px',
  background: 'rgba(45,90,61,0.28)',
  pointerEvents: 'none',
};

function scoreColor(val) {
  if (val === null || val === undefined) return 'text-pool-faint';
  if (val === 'E' || val === 0) return 'text-pool-even';
  if (typeof val === 'number') {
    if (val < 0) return 'text-pool-under';
    if (val > 0) return 'text-pool-over';
  }
  return 'text-pool-faint';
}

function rankStyle(rank) {
  if (rank === 1) return 'text-pool-gold font-bold';
  if (rank === 2) return 'text-gray-300 font-bold';
  if (rank === 3) return 'text-amber-600 font-bold';
  return 'text-gray-500';
}

function formatScore(val) {
  if (val === null || val === undefined) return '—';
  if (val === 'E' || val === 0) return 'E';
  if (typeof val === 'number') {
    if (val > 0) return `+${val}`;
    return String(val);
  }
  return String(val);
}

function isNumericLike(val) {
  return typeof val === 'number' || val === 'E';
}

export default function HybridTeamRow({
  rank,
  teamName,
  total,
  rounds = [],
  isExpanded,
  onToggle,
  children,
}) {
  const leaderBorder = rank === 1 ? 'border-l-2 border-pool-gold' : 'border-l-2 border-transparent';

  const roundLabels = ['R1', 'R2', 'R3', 'R4'];

  return (
    <div className="bg-pool-surface border-b border-pool-rim">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-3 py-2 ${leaderBorder}`}
      >
        <div className="flex items-center gap-3">
          {/* Rank badge */}
          <span className={`w-6 text-center text-sm shrink-0 ${rankStyle(rank)}`}>
            {rank}
          </span>

          {/* Team name + round sub-row */}
          <div className="flex-1 min-w-0">
            <span className="block text-pool-primary font-semibold truncate leading-tight">
              {teamName}
            </span>
            <div className="flex gap-3 mt-0.5">
              {roundLabels.map((label, i) => {
                const val = rounds[i] ?? null;
                const numeric = isNumericLike(val);
                return (
                  <span key={label} className="text-xs">
                    <span className="text-pool-muted">{label}: </span>
                    <span className={numeric ? scoreColor(val) : 'text-pool-faint'}>
                      {numeric ? formatScore(val) : (val != null ? String(val) : '—')}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Total score */}
          <span className={`font-mono font-bold text-2xl shrink-0 ${scoreColor(total)}`}>
            {formatScore(total)}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="bg-pool-elevated border-t border-pool-rim" style={{ position: 'relative' }}>
          {/* Continuous vertical dividers — span the full height of this container */}
          <div style={{ ...DIVIDER_STYLE, right: '3.25rem' }} />
          <div style={{ ...DIVIDER_STYLE, right: '11.25rem' }} />

          {/* Column header row */}
          <div
            className="px-3 pt-2 pb-1 border-b border-pool-rim"
            style={{ display: 'grid', gridTemplateColumns: PLAYER_GRID_COLS, gap: '0' }}
          >
            <span className="block text-[9px] text-pool-faint text-center">#</span>
            <span className="block text-[9px] text-pool-faint">Player</span>
            <span className="block text-[9px] text-pool-faint text-center">Thru</span>
            <span className="block text-[9px] text-pool-faint text-center">R1</span>
            <span className="block text-[9px] text-pool-faint text-center">R2</span>
            <span className="block text-[9px] text-pool-faint text-center">R3</span>
            <span className="block text-[9px] text-pool-faint text-center">R4</span>
            <span className="block text-[9px] text-pool-faint text-right">Tot</span>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
