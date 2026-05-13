// Divider positions are defined in index.css as .player-divider-r1 / .player-divider-tot
// (responsive — right offset shifts on mobile because R1-R4 columns are narrower).
const DIVIDER_BASE = {
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

/** ↑↓ movement indicator — positive = moved up, negative = moved down */
function MovementBadge({ movement }) {
  if (!movement) return null;
  if (movement > 0) {
    return (
      <span className="flex items-center gap-0.5 text-pool-under text-[10px] font-bold leading-none">
        <span>↑</span>
        <span>{movement}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-pool-over text-[10px] font-bold leading-none">
      <span>↓</span>
      <span>{Math.abs(movement)}</span>
    </span>
  );
}

export default function HybridTeamRow({
  rank,
  teamName,
  total,
  rounds = [],
  isExpanded,
  onToggle,
  children,
  movement = 0,       // positions gained (positive) or lost (negative) since last refresh
  aliveCount = null,  // number of players still alive (not CUT/WD/DQ/MDF), out of 6
  isFlashing = false, // true briefly when score changes — triggers flash animation
}) {
  const isLeader = rank === 1;

  // Leader: gold left border + subtle gold shadow glow
  const leaderBorder = isLeader
    ? 'border-l-2 border-pool-gold'
    : 'border-l-2 border-transparent';
  const leaderGlow = isLeader
    ? 'shadow-[inset_0_0_24px_rgba(212,175,55,0.08),0_0_0_1px_rgba(212,175,55,0.15)]'
    : '';

  const roundLabels = ['R1', 'R2', 'R3', 'R4'];

  return (
    <div className={`bg-pool-surface border-b border-pool-rim ${isFlashing ? 'score-flash' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-3 py-2 ${leaderBorder} ${leaderGlow}`}
      >
        <div className="flex items-center gap-3">
          {/* Rank + movement */}
          <div className="flex flex-col items-center w-6 shrink-0 gap-0.5">
            <span className={`text-sm text-center ${rankStyle(rank)}`}>{rank}</span>
            <MovementBadge movement={movement} />
          </div>

          {/* Team name + round sub-row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="block text-pool-primary font-semibold truncate leading-tight">
                {teamName}
              </span>
              {/* Alive count badge — only show when someone has been cut */}
              {aliveCount !== null && aliveCount < 6 && (
                <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  aliveCount <= 3
                    ? 'bg-red-900/60 text-red-300'
                    : aliveCount <= 4
                    ? 'bg-amber-900/60 text-amber-300'
                    : 'bg-pool-surface text-pool-muted border border-pool-rim'
                }`}>
                  {aliveCount}/6
                </span>
              )}
            </div>
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
          {/* Continuous vertical dividers — positions defined in index.css (responsive) */}
          <div className="player-divider-tot" style={DIVIDER_BASE} />
          <div className="player-divider-r1"  style={DIVIDER_BASE} />

          {/* Column header row — same responsive grid as player rows */}
          <div className="player-row-grid px-3 pt-2 pb-1 border-b border-pool-rim">
            <span className="block text-[9px] text-pool-faint text-center">#</span>
            <span className="block text-[9px] text-pool-faint text-center" />
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
