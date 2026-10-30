import { useState, useEffect, useRef } from 'react';

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
  if (rank === 2) return 'text-[#cbd5d1] font-bold';
  if (rank === 3) return 'text-[#c9893f] font-bold';
  return 'text-pool-even';
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

/**
 * Smoothly counts from old score to new score (600ms cubic ease-out)
 * when the `value` prop changes. Falls back to instant update for non-numeric
 * transitions (e.g. null → -3, or 'E' → non-'E').
 */
function AnimatedScore({ value, className }) {
  const toNumeric = (v) => (v === 'E' ? 0 : (typeof v === 'number' ? v : null));
  const [displayed, setDisplayed] = useState(value);
  // The number currently ON SCREEN — used as the animation's starting point so
  // an interrupt (a new value mid-tween) continues from where it visually is,
  // not from a pre-advanced baseline. That was the cause of the score "jump".
  const displayedNumRef = useRef(toNumeric(value));
  const rafRef = useRef(null);

  useEffect(() => {
    const to = value;
    const toNum = toNumeric(to);
    const fromNum = displayedNumRef.current;

    // Non-numeric transition (null↔score) or no change → snap instantly.
    if (fromNum === null || toNum === null || fromNum === toNum) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      displayedNumRef.current = toNum;
      setDisplayed(to);
      return;
    }

    const duration = 600;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      const cur = Math.round(fromNum + (toNum - fromNum) * eased);
      displayedNumRef.current = cur;
      setDisplayed(cur);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayedNumRef.current = toNum;
        setDisplayed(to); // snap to exact final value
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <span className={className}>{formatScore(displayed)}</span>;
}

/** ▲▼ movement indicator — positive = moved up, negative = moved down */
function MovementBadge({ movement }) {
  if (!movement) return null;
  const up = movement > 0;
  return (
    <span className={`flex items-center gap-0.5 font-mono text-[10px] font-bold leading-none ${up ? 'text-pool-under' : 'text-pool-over'}`}>
      <span>{up ? '▲' : '▼'}</span>
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
  const roundLabels = ['R1', 'R2', 'R3', 'R4'];

  const roundCell = (val) => {
    const numeric = isNumericLike(val);
    const text = numeric ? formatScore(val) : (val != null ? String(val) : '—');
    const color = numeric ? scoreColor(val) : 'text-pool-faint';
    return { text, color };
  };

  return (
    <div
      className={`relative rounded-xl mb-2 overflow-hidden bg-pool-surface border ${
        isLeader ? 'leader-card' : 'border-pool-rim/50'
      } ${isFlashing ? 'score-flash' : ''}`}
    >
      {isLeader && <span className="leader-rail" aria-hidden="true" />}

      <button
        type="button"
        onClick={onToggle}
        className="team-row-grid w-full text-left px-3.5 py-3 sm:px-4 sm:py-3.5"
      >
        {/* Rank + movement */}
        <div className="flex flex-col items-center gap-0.5">
          <span className={`font-mono tabular-nums text-base leading-none ${rankStyle(rank)}`}>{rank}</span>
          <MovementBadge movement={movement} />
        </div>

        {/* Team name + mobile inline round sub-row */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="block text-pool-primary font-bold truncate leading-tight">
              {teamName}
            </span>
            {/* Alive count badge — only show when someone has been cut */}
            {aliveCount !== null && aliveCount < 6 && (
              <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full leading-none ${
                aliveCount <= 3
                  ? 'bg-red-900/50 text-red-300'
                  : aliveCount <= 4
                  ? 'bg-amber-900/50 text-amber-300'
                  : 'text-pool-muted border border-pool-rim'
              }`}>
                {aliveCount}/6
              </span>
            )}
          </div>
          <div className="team-inline-rounds flex gap-3.5 mt-1.5 font-mono tabular-nums text-xs">
            {roundLabels.map((label, i) => {
              const { text, color } = roundCell(rounds[i] ?? null);
              return (
                <span key={label} className="inline-flex gap-1">
                  <span className="text-pool-faint">{label}</span>
                  <span className={`font-bold ${color}`}>{text}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Desktop aligned round columns (hidden on mobile via .team-round-col) */}
        {roundLabels.map((label, i) => {
          const { text, color } = roundCell(rounds[i] ?? null);
          return (
            <span key={label} className={`team-round-col text-center font-mono tabular-nums text-sm font-bold ${color}`}>
              {text}
            </span>
          );
        })}

        {/* Total score — animates when value changes */}
        <AnimatedScore
          value={total}
          className={`font-mono font-bold text-2xl tabular-nums text-right ${scoreColor(total)}`}
        />
      </button>

      {isExpanded && (
        <div className="bg-pool-elevated border-t border-pool-rim" style={{ position: 'relative' }}>
          {/* Continuous vertical dividers — positions defined in index.css (responsive) */}
          <div className="player-divider-tot" style={DIVIDER_BASE} />
          <div className="player-divider-r1"  style={DIVIDER_BASE} />

          {/* Column header row — same responsive grid as player rows */}
          <div className="player-row-grid px-2 pt-2 pb-1 sm:px-3 border-b border-pool-rim">
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">#</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center" />
            <span className="block text-[9px] lg:text-xs text-pool-faint">Player</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">Thru</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">R1</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">R2</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">R3</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-center">R4</span>
            <span className="block text-[9px] lg:text-xs text-pool-faint text-right">Tot</span>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
