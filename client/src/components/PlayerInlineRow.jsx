import { useState } from 'react';

// Shared grid layout — imported by HybridTeamRow for the column header row.
// Dividers are NOT in this grid; they are absolutely positioned on the container in HybridTeamRow.
// Columns: pos | avatar | name | thru | R1 | R2 | R3 | R4 | Tot
export const PLAYER_GRID_COLS = '1.5rem 1.75rem 1fr 1.75rem 2rem 2rem 2rem 2rem 2.5rem';

const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'W/D']);

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

/**
 * Player headshot from ESPN CDN. Falls back to initials circle on error.
 * ESPN publishes photos at a predictable URL by player ID — no API key needed.
 */
function PlayerAvatar({ espnId, name }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (!espnId || failed) {
    return (
      <span className="w-6 h-6 rounded-full bg-pool-rim flex items-center justify-center text-[7px] text-pool-faint font-bold select-none">
        {initials}
      </span>
    );
  }

  return (
    <img
      src={`https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png`}
      alt={name}
      className="w-6 h-6 rounded-full object-cover object-top bg-pool-rim"
      onError={() => setFailed(true)}
    />
  );
}

export default function PlayerInlineRow({
  espnId,
  pos,
  name,
  thru,
  rounds = [null, null, null, null],
  countingRounds = [false, false, false, false],
  total,
  isCut = false,
  overallStatus = '',
}) {
  const cutLabel = CUT_STATUSES.has(overallStatus?.toUpperCase()) ? overallStatus.toUpperCase() : 'CUT';

  return (
    <div
      className="bg-pool-elevated px-3 py-1.5"
      style={{ display: 'grid', gridTemplateColumns: PLAYER_GRID_COLS, alignItems: 'center', gap: '0' }}
    >
      {/* Position */}
      <span className="block text-[10px] text-pool-muted text-center">{pos}</span>

      {/* Avatar */}
      <span className="flex items-center justify-center">
        <PlayerAvatar espnId={espnId} name={name} />
      </span>

      {/* Player name + CUT badge */}
      <span className={`flex items-center gap-1 min-w-0 pr-2${isCut ? ' opacity-50' : ''}`}>
        <span className={`text-sm font-medium truncate ${isCut ? 'text-pool-muted' : 'text-pool-primary'}`}>
          {name}
        </span>
        {isCut && (
          <span className="shrink-0 text-[7px] font-bold px-1 py-0.5 rounded bg-red-900/70 text-red-300 leading-none uppercase tracking-wide">
            {cutLabel}
          </span>
        )}
      </span>

      {/* Thru */}
      <span className={`block text-[10px] text-center${isCut ? ' opacity-40 text-pool-muted' : ' text-pool-muted'}`}>
        {thru ?? '—'}
      </span>

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

        // Unplayed rounds for cut players — blank (badge in name cell handles labeling)
        if (!hasScore && isCut) {
          return (
            <span key={i} className="block text-xs font-mono text-center opacity-30 text-pool-faint">
              —
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
      <span className={`block text-sm font-mono font-bold text-right ${isCut ? 'opacity-50 ' : ''}${totalColor(total)}`}>
        {formatTotal(total)}
      </span>
    </div>
  );
}
