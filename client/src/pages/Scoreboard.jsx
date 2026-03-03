import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';
import { formatTournamentDates, statusLabel } from '../utils/tournament.js';

function TeamRoundScore({ val }) {
  if (val === null || val === undefined) return <span className="text-gray-300">—</span>;
  return (
    <span className="font-mono text-sm text-gray-800">
      {val === 0 ? 'E' : val > 0 ? `+${val}` : String(val)}
    </span>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-gray-700 text-xs font-bold">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-white text-xs font-bold">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">{rank}</span>;
}

function TeamScoreCell({ val }) {
  if (val === null || val === undefined) return <span className="text-gray-300">—</span>;
  const isOver = val > 0;
  return (
    <span className={`inline-block font-semibold font-mono px-2 py-0.5 rounded border border-gray-800 ${
      isOver ? 'bg-red-50 text-red-800' : 'bg-green-100 text-gray-900'
    }`}>
      {val === 0 ? 'E' : val > 0 ? `+${val}` : String(val)}
    </span>
  );
}

function RoundCell({ raw, counting, isCut }) {
  if (raw == null && isCut) return <span className="text-[10px] text-gray-400 font-medium tracking-wide">CUT</span>;
  if (raw == null) return <span className="text-gray-300 text-sm">—</span>;
  const s = String(raw).trim().toUpperCase();
  const numeric = s === 'E' ? 0 : parseInt(s, 10);
  const isNum = !isNaN(numeric);
  return (
    <span className={`inline-block text-sm font-mono px-1.5 py-0.5 rounded ${
      counting ? 'bg-emerald-700 text-white font-semibold shadow-sm'
      : isNum && numeric > 0 ? 'text-rose-600'
      : 'text-gray-600'
    }`}>{raw}</span>
  );
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

const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'W/D']);

export default function Scoreboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const activeTournamentId = searchParams.get('t');

  function toggleTeam(teamId) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  }

  useEffect(() => {
    getTournaments().then((data) => {
      setTournaments(data.tournaments);
      if (!activeTournamentId && data.tournaments.length > 0) {
        setSearchParams({ t: data.tournaments[0].id }, { replace: true });
      }
    }).finally(() => setTournamentsLoading(false));
  }, []);

  const activeTournament = tournaments.find(t => String(t.id) === String(activeTournamentId));

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

  const intervalMs = shouldAutoRefresh(activeTournament) ? 10 * 60 * 1000 : null;

  const fetchScoreboard = useCallback(() => {
    if (!activeTournamentId) return Promise.resolve(null);
    return getScoreboard(activeTournamentId);
  }, [activeTournamentId]);

  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchScoreboard, intervalMs);

  if (tournamentsLoading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-3">No tournaments saved yet.</p>
        <Link to="/setup" className="text-golf-green underline">Go to Setup →</Link>
      </div>
    );
  }

  const teams = data?.teams ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Scoreboard</h1>
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      </div>

      {/* Tournament selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="tournament-select" className="text-sm font-medium text-gray-600 whitespace-nowrap">
          Tournament
        </label>
        <select
          id="tournament-select"
          value={activeTournamentId ?? ''}
          onChange={(e) => setSearchParams({ t: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-golf-green focus:border-golf-green"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          Loading scores…
        </div>
      )}

      {data && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-golf-dark border-b border-gray-700 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-white">
                  {data.tournament?.name}
                </span>
                <span className="text-xs text-gray-300">{formatTournamentDates(data.tournament)}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                statusLabel(data.tournament?.status) === 'Live'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-white/10 text-gray-300'
              }`}>
                {statusLabel(data.tournament?.status)}
              </span>
            </div>

            {data.teams.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No picks yet for this tournament.</p>
                <Link
                  to={`/picks/${activeTournamentId}`}
                  className="text-golf-green underline text-sm mt-2 block"
                >
                  Make picks →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="bg-golf-dark text-white text-xs uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-medium w-10">#</th>
                      <th className="text-left px-3 py-3 font-medium">Team</th>
                      <th className="text-right px-3 py-3 font-medium">R1</th>
                      <th className="text-right px-3 py-3 font-medium">R2</th>
                      <th className="text-right px-3 py-3 font-medium">R3</th>
                      <th className="text-right px-3 py-3 font-medium">R4</th>
                      <th className="text-right px-5 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.teams.map((team, i) => {
                      const isLeader = i === 0;
                      const isExpanded = expandedTeams.has(team.team_id);
                      return (
                        <>
                          <tr
                            key={team.team_id}
                            className={`hover:bg-gray-50 transition-colors ${
                              isLeader
                                ? 'bg-gradient-to-r from-amber-50 to-yellow-50/30 border-l-4 border-golf-gold'
                                : ''
                            }`}
                          >
                            <td className="px-3 py-3.5 text-sm">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => toggleTeam(team.team_id)}
                                  className="text-gray-400 hover:text-golf-green transition-colors p-0.5 rounded text-xs"
                                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                                <RankBadge rank={i + 1} />
                              </div>
                            </td>
                            <td className="px-3 py-3.5">
                              <Link
                                to={`/team/${team.team_id}?t=${activeTournamentId}`}
                                className="font-semibold text-gray-800 hover:text-golf-green transition-colors text-sm"
                              >
                                {team.team_name}
                              </Link>
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm">
                              <TeamRoundScore val={team.rounds?.[1]} />
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm">
                              <TeamRoundScore val={team.rounds?.[2]} />
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm">
                              <TeamRoundScore val={team.rounds?.[3]} />
                            </td>
                            <td className="px-3 py-3.5 text-right text-sm">
                              <TeamRoundScore val={team.rounds?.[4]} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {team.total === null
                                ? <span className="text-gray-400 text-sm">—</span>
                                : <TeamScoreCell val={team.total} />
                              }
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${team.team_id}-drawer`} className="bg-gray-50 border-b border-gray-200">
                              <td colSpan={7} className="px-4 pb-4 pt-2">
                                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                  <table className="w-full min-w-[560px]">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase tracking-wider" style={{fontSize:'10px'}}>
                                        <th className="text-center px-3 py-2 font-medium">Pos</th>
                                        <th className="text-left px-4 py-2 font-medium">Player</th>
                                        <th className="text-center px-3 py-2 font-medium">Thru</th>
                                        <th className="text-center px-3 py-2 font-medium border-l border-gray-200">R1</th>
                                        <th className="text-center px-3 py-2 font-medium">R2</th>
                                        <th className="text-center px-3 py-2 font-medium">R3</th>
                                        <th className="text-center px-3 py-2 font-medium">R4</th>
                                        <th className="text-center px-3 py-2 font-medium border-l border-gray-200">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {[...(team.players ?? [])].sort((a, b) => {
                                        const ta = playerTotal(a.rounds), tb = playerTotal(b.rounds);
                                        if (ta === null && tb === null) return 0;
                                        if (ta === null) return 1;
                                        if (tb === null) return -1;
                                        return ta - tb;
                                      }).map((player) => {
                                        const noEligible = player.eligible_rounds?.length === 0;
                                        const isCut = CUT_STATUSES.has(player.overallStatus?.toUpperCase() ?? '');
                                        return (
                                          <tr key={player.player_espn_id} className={`hover:bg-slate-50 ${noEligible ? 'opacity-40' : ''}`}>
                                            <td className="px-3 py-3 text-center font-mono text-gray-400 text-xs">
                                              {isCut ? <span className="text-gray-400">CUT</span> : player.rank ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                              <span className={noEligible ? 'line-through text-gray-400 italic' : 'text-gray-800 font-medium'}>
                                                {player.player_name}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-center font-mono text-gray-400 text-xs">
                                              {isCut ? 'CUT' : player.thru != null ? player.thru : '—'}
                                            </td>
                                            {[1, 2, 3, 4].map((r) => (
                                              <td key={r} className={`px-3 py-3 text-center${r === 1 ? ' border-l border-gray-200' : ''}`}>
                                                <RoundCell raw={player.rounds?.[r]} counting={player.counting_rounds?.includes(r)} isCut={isCut} />
                                              </td>
                                            ))}
                                            <td className="px-3 py-3 text-center border-l border-gray-200">
                                              {noEligible
                                                ? <span className="text-gray-300 text-sm">—</span>
                                                : <TeamScoreCell val={playerTotal(player.rounds)} />
                                              }
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
