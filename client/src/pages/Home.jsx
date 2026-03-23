import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import { formatTournamentDates, statusLabel } from '../utils/tournament.js';
import HybridTeamRow from '../components/HybridTeamRow.jsx';
import PlayerInlineRow from '../components/PlayerInlineRow.jsx';
import LastUpdated from '../components/LastUpdated.jsx';

function shouldAutoRefresh(tournament) {
  if (!tournament) return false;
  const now = new Date();
  const windowStart = new Date(tournament.start_date);
  windowStart.setDate(windowStart.getDate() - 1);
  const endBase = tournament.end_date
    ? new Date(tournament.end_date)
    : (() => { const d = new Date(tournament.start_date); d.setDate(d.getDate() + 3); return d; })();
  const windowEnd = new Date(endBase);
  windowEnd.setDate(windowEnd.getDate() + 1);
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

export default function Home() {
  const [tournaments, setTournaments] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
  const intervalMs = autoRefresh ? 10 * 60 * 1000 : null;

  const fetchFn = useCallback(() => {
    if (!selectedId) return Promise.resolve(null);
    return getScoreboard(selectedId);
  }, [selectedId]);

  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchFn, intervalMs);

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

  return (
    <div className="space-y-3 p-4">

      {/* Tournament title — acts as the dropdown selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(p => !p)}
          className="flex items-start gap-1.5 group text-left"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <h1 className="text-2xl font-bold text-pool-primary group-hover:text-pool-secondary transition-colors leading-tight">
            {selectedTournament?.name ?? '—'}
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
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tournament meta: status, dates, course */}
      {selectedTournament && (
        <div className="space-y-0.5">
          <p className="text-xs text-pool-muted uppercase tracking-widest">
            {statusLabel(data?.tournament?.status ?? selectedTournament.status)}
            {' · '}
            {formatTournamentDates(selectedTournament)}
          </p>
          {data?.tournament?.course && (
            <p className="text-xs text-pool-faint">
              {data.tournament.course}
              {data.tournament.par ? ` · Par ${data.tournament.par}` : ''}
            </p>
          )}
        </div>
      )}

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
        <div className="bg-pool-err-bg border border-red-900 rounded-xl p-4 text-pool-err-fg text-sm">
          {error}
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
          {data.teams.map((team, idx) => {
            const teamRounds = [
              team.rounds?.[1],
              team.rounds?.[2],
              team.rounds?.[3],
              team.rounds?.[4],
            ];
            const isExpanded = expandedTeams.has(team.team_id);
            const sortedPlayers = sortPlayers(team.players ?? []);

            return (
              <HybridTeamRow
                key={team.team_id}
                rank={idx + 1}
                teamName={team.team_name}
                total={team.total}
                rounds={teamRounds}
                isExpanded={isExpanded}
                onToggle={() => toggleTeam(team.team_id)}
              >
                {sortedPlayers.map(player => {
                  const isCut = ['CUT', 'WD', 'DQ', 'MDF', 'W/D'].includes(
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
                  const pos = isCut
                    ? (player.overallStatus ?? 'CUT').toUpperCase()
                    : (player.rank ?? '—');

                  return (
                    <PlayerInlineRow
                      key={player.player_espn_id}
                      pos={pos}
                      name={player.player_name}
                      thru={player.thru ?? '—'}
                      rounds={playerRounds}
                      countingRounds={countingRounds}
                      total={total}
                      isCut={isCut}
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
