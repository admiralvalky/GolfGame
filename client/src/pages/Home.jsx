import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import { formatTournamentDates, statusLabel } from '../utils/tournament.js';
import HybridTeamRow from '../components/HybridTeamRow.jsx';
import PlayerInlineRow from '../components/PlayerInlineRow.jsx';
import LastUpdated from '../components/LastUpdated.jsx';

// Auto-refresh window: ±1 day around tournament start/end.
const AUTO_REFRESH_WINDOW_DAYS = 1;
// Interval for auto-refresh during active window (ms).
const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
// CUT statuses — used to compute alive count per team
const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'W/D']);

function tournamentDisplayName(t) {
  if (!t) return '—';
  const year = t.start_date ? new Date(t.start_date).getFullYear() : null;
  const suffix = year ? ` '${String(year).slice(2)}` : '';
  return `${t.name}${suffix}`;
}

function shouldAutoRefresh(tournament) {
  if (!tournament) return false;
  const now = new Date();
  const windowStart = new Date(tournament.start_date);
  windowStart.setDate(windowStart.getDate() - AUTO_REFRESH_WINDOW_DAYS);
  const endBase = tournament.end_date
    ? new Date(tournament.end_date)
    : (() => { const d = new Date(tournament.start_date); d.setDate(d.getDate() + 3); return d; })();
  const windowEnd = new Date(endBase);
  windowEnd.setDate(windowEnd.getDate() + AUTO_REFRESH_WINDOW_DAYS);
  return now >= windowStart && now <= windowEnd;
}

function playerTotal(rounds) {
  let sum = null;
  for (let r = 1; r <= 4; r++) {
    const raw = rounds?.[r];
    if (raw == null) continue;
    const s = String(raw).trim().toUpperCase();
    const n = s === 'E' ? 0 : parseInt(s, 10);
    if (!isNaN(n)) { if (sum === null) sum = 0; sum += n; }
  }
  return sum;
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const ta = playerTotal(a.rounds);
    const tb = playerTotal(b.rounds);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

/** Pulsing live indicator dot — shown when tournament status is 'in'. */
function LiveDot() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pool-under opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-pool-under" />
      </span>
      <span className="text-[10px] font-semibold text-pool-under uppercase tracking-widest">Live</span>
    </span>
  );
}

/** Course hero card — venue name, par, and optional city/state with gold accents. */
function CourseHero({ course, par, city, state }) {
  if (!course) return null;
  const location = [city, state].filter(Boolean).join(', ');
  return (
    <div className="relative overflow-hidden rounded-xl border border-pool-gold/20 bg-pool-elevated">
      {/* Gold shimmer line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pool-gold/60 to-transparent pointer-events-none" />
      {/* Gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-pool-rim/30 via-transparent to-pool-gold/5 pointer-events-none" />
      {/* Decorative concentric rings (right side) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-pool-gold/10 opacity-50 pointer-events-none" />
      <div className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-pool-gold/10 opacity-40 pointer-events-none" />

      <div className="relative flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-pool-gold/70 font-semibold mb-1">
            <span>⛳</span><span>This Week's Course</span>
          </p>
          <p className="text-base font-bold text-pool-primary leading-snug truncate">{course}</p>
          {location && (
            <p className="text-xs text-pool-muted mt-0.5">{location}</p>
          )}
        </div>
        {par && (
          <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full border border-pool-gold/35 bg-pool-gold/8">
            <span className="text-[9px] text-pool-gold/65 uppercase tracking-wide font-semibold leading-none">Par</span>
            <span className="text-xl font-bold text-pool-gold leading-tight">{par}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [tournaments, setTournaments] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Round-based movement: stored in localStorage, keyed by tournament+round
  const [movements, setMovements] = useState({});

  // Score flash: brief animation when scores change
  const prevScoresRef = useRef({});
  const [flashingTeams, setFlashingTeams] = useState(new Set());
  const flashTimerRef = useRef(null);

  // Venue info: fetched from Core API when scoreboard doesn't include it
  const [venueInfo, setVenueInfo] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    getTournaments().then(({ tournaments: list }) => {
      setTournaments(list);
      const active = list.find(t => t.status === 'in');
      setSelectedId((active ?? list[0])?.id ?? null);
    });
  }, []);

  const selectedTournament = tournaments?.find(t => t.id === selectedId) ?? null;
  const autoRefresh = shouldAutoRefresh(selectedTournament);
  const intervalMs = autoRefresh ? AUTO_REFRESH_INTERVAL_MS : null;

  const fetchFn = useCallback(() => {
    if (!selectedId) return Promise.resolve(null);
    return getScoreboard(selectedId);
  }, [selectedId]);

  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchFn, intervalMs);

  // Fetch venue details (course name, city, state) from Core API when scoreboard
  // doesn't include them — happens for post-tournament (cache) and some live events.
  useEffect(() => {
    const espnId = data?.tournament?.espn_tournament_id;
    if (!espnId) { setVenueInfo(null); return; }
    if (data.tournament.course) { setVenueInfo(null); return; } // scoreboard already has it
    let cancelled = false;
    fetch(`/api/espn?route=details&id=${espnId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.courseName) setVenueInfo(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [data?.tournament?.espn_tournament_id, data?.tournament?.course]);

  // Track score-change flashes + round-based rank movement
  useEffect(() => {
    if (!data?.teams) return;

    // ── Score flash: brief animation when team total changes ─────────────
    const newFlashing = new Set();
    const currentScores = {};
    for (const team of data.teams) {
      currentScores[team.team_id] = team.total;
      if (
        prevScoresRef.current[team.team_id] !== undefined &&
        prevScoresRef.current[team.team_id] !== team.total
      ) {
        newFlashing.add(team.team_id);
      }
    }
    prevScoresRef.current = currentScores;
    if (newFlashing.size > 0) {
      setFlashingTeams(newFlashing);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashingTeams(new Set()), 1800);
    }

    // ── Round-based movement: compare current rank to previous round's end ─
    // Hide arrows the day after the tournament finishes.
    const status = data.tournament?.status ?? selectedTournament?.status;
    const hideMovement = (() => {
      if (status !== 'post') return false;
      const endDate = selectedTournament?.end_date;
      if (!endDate) return false;
      const cutoff = new Date(endDate);
      cutoff.setDate(cutoff.getDate() + 1);
      return new Date() > cutoff;
    })();

    if (hideMovement) { setMovements({}); return; }

    // Determine the highest round that has any score across all teams
    let currentRound = 0;
    for (const team of data.teams) {
      for (const [k, v] of Object.entries(team.rounds ?? {})) {
        const r = Number(k);
        if (!isNaN(r) && v != null && r > currentRound) currentRound = r;
      }
    }
    currentRound = currentRound || 1;

    const currentRanks = {};
    for (const team of data.teams) currentRanks[team.team_id] = team.rank;

    // Load localStorage snapshot — { round: N, ranks: { teamId: rank } }
    const lsKey = `golf_round_baseline_${selectedId}`;
    let baseline = null;
    try { baseline = JSON.parse(localStorage.getItem(lsKey) ?? 'null'); } catch {}

    const newMovements = {};
    if (baseline && baseline.round < currentRound) {
      // Round advanced → movement = prevRoundRank - currentRank (positive = moved up)
      for (const team of data.teams) {
        const prev = baseline.ranks?.[team.team_id];
        newMovements[team.team_id] = prev != null ? prev - team.rank : 0;
      }
    }
    // Same round or no baseline → no arrows (0 movement)
    setMovements(newMovements);

    // Always persist current state so end-of-round snapshot stays fresh
    try {
      localStorage.setItem(lsKey, JSON.stringify({ round: currentRound, ranks: currentRanks }));
    } catch {}
  }, [data, selectedId, selectedTournament]);

  // Reset movement/flash state when tournament changes
  useEffect(() => {
    prevScoresRef.current = {};
    setMovements({});
    setFlashingTeams(new Set());
  }, [selectedId]);

  function toggleTeam(teamId) {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  // Tournaments still loading
  if (tournaments === null) {
    return (
      <div className="space-y-2 p-4">
        <div className="bg-pool-surface animate-pulse rounded h-10 mb-4" />
        <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
        <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
        <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
      </div>
    );
  }

  // No tournaments
  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-pool-faint text-sm">No tournaments set up yet.</p>
        <Link to="/setup" className="text-pool-under text-sm underline mt-2 block">Go to Setup →</Link>
      </div>
    );
  }

  const effectiveStatus = data?.tournament?.status ?? selectedTournament?.status;
  const isLive = effectiveStatus === 'in';

  return (
    <div className="space-y-3 px-2 py-4 sm:p-4">

      {/* Tournament title — acts as the dropdown selector */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setDropdownOpen(p => !p)}
            className="flex items-start gap-1.5 group text-left"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <h1 className="text-2xl font-bold text-pool-primary group-hover:text-pool-secondary transition-colors leading-tight">
              {tournamentDisplayName(selectedTournament)}
            </h1>
            {tournaments.length > 1 && (
              <svg
                className="w-4 h-4 mt-1.5 text-pool-faint group-hover:text-pool-muted transition-colors shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {isLive && <LiveDot />}
        </div>

        {/* Dropdown list */}
        {dropdownOpen && tournaments.length > 1 && (
          <div
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1.5 bg-pool-elevated border border-pool-rim rounded-xl shadow-2xl overflow-hidden min-w-[14rem]"
          >
            {tournaments.map(t => (
              <button
                key={t.id}
                role="option"
                aria-selected={t.id === selectedId}
                type="button"
                onClick={() => { setSelectedId(t.id); setDropdownOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-pool-surface border-l-2 ${
                  t.id === selectedId
                    ? 'text-pool-under font-semibold border-pool-under'
                    : 'text-pool-secondary border-transparent'
                }`}
              >
                {tournamentDisplayName(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tournament meta */}
      {selectedTournament && (
        <p className="text-xs text-pool-muted uppercase tracking-widest">
          {statusLabel(effectiveStatus)}
          {' · '}
          {formatTournamentDates(selectedTournament)}
        </p>
      )}

      {/* Course hero card */}
      <CourseHero
        course={data?.tournament?.course ?? venueInfo?.courseName}
        par={data?.tournament?.par ?? venueInfo?.par}
        city={venueInfo?.city}
        state={venueInfo?.state}
      />

      {/* Scoreboard loading state */}
      {loading && (
        <div className="space-y-2">
          <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
          <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
          <div className="bg-pool-surface animate-pulse rounded h-16 mb-2" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-pool-err-bg border border-red-900 rounded-xl p-4 text-pool-err-fg text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={refresh}
            className="shrink-0 text-pool-secondary hover:text-pool-primary underline text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* No picks empty state */}
      {!loading && !error && data && data.teams?.length === 0 && (
        <div className="text-center py-8 text-pool-faint text-sm">
          <p>No picks yet for this tournament.</p>
          <Link to={`/picks/${selectedId}`} className="text-pool-under underline mt-2 block">Make picks →</Link>
        </div>
      )}

      {/* Leaderboard */}
      {!loading && !error && data?.teams?.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-pool-rim">
          {data.teams.map((team) => {
            const teamRounds = [
              team.rounds?.[1],
              team.rounds?.[2],
              team.rounds?.[3],
              team.rounds?.[4],
            ];
            const isExpanded = expandedTeams.has(team.team_id);
            const sortedPlayers = sortPlayers(team.players ?? []);

            // Count players still alive (not CUT/WD/DQ/MDF)
            const aliveCount = team.players?.filter(
              p => !CUT_STATUSES.has((p.overallStatus ?? '').toUpperCase())
            ).length ?? null;

            return (
              <HybridTeamRow
                key={team.team_id}
                rank={team.rank}
                teamName={team.team_name}
                total={team.total}
                rounds={teamRounds}
                isExpanded={isExpanded}
                onToggle={() => toggleTeam(team.team_id)}
                movement={movements[team.team_id] ?? 0}
                aliveCount={aliveCount}
                isFlashing={flashingTeams.has(team.team_id)}
              >
                {sortedPlayers.map(player => {
                  const isCut = CUT_STATUSES.has(
                    (player.overallStatus ?? '').toUpperCase()
                  );
                  const playerRounds = [
                    player.rounds?.[1],
                    player.rounds?.[2],
                    player.rounds?.[3],
                    player.rounds?.[4],
                  ];
                  const countingRounds = [1, 2, 3, 4].map(r =>
                    player.counting_rounds?.includes(r) ?? false
                  );
                  const total = playerTotal(player.rounds);
                  const pos = player.rank ?? '—';

                  return (
                    <PlayerInlineRow
                      key={player.player_espn_id}
                      espnId={player.player_espn_id}
                      pos={pos}
                      name={player.player_name}
                      thru={player.thru ?? '—'}
                      rounds={playerRounds}
                      countingRounds={countingRounds}
                      total={total}
                      isCut={isCut}
                      overallStatus={player.overallStatus ?? ''}
                    />
                  );
                })}
              </HybridTeamRow>
            );
          })}
        </div>
      )}

      {/* Last updated footer */}
      {!loading && data && (
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      )}
    </div>
  );
}
