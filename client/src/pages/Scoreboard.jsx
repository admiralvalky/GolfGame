import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';
import ScoreTag from '../components/ScoreTag.jsx';

function RoundScore({ val }) {
  if (val === null || val === undefined) return <span className="text-gray-300">—</span>;
  return <ScoreTag score={val} raw={val === 0 ? 'E' : String(val)} />;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-gray-700 text-xs font-bold">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-white text-xs font-bold">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">{rank}</span>;
}

export default function Scoreboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);

  const activeTournamentId = searchParams.get('t');

  useEffect(() => {
    getTournaments().then((data) => {
      setTournaments(data.tournaments);
      if (!activeTournamentId && data.tournaments.length > 0) {
        setSearchParams({ t: data.tournaments[0].id }, { replace: true });
      }
    }).finally(() => setTournamentsLoading(false));
  }, []);

  const fetchScoreboard = useCallback(() => {
    if (!activeTournamentId) return Promise.resolve(null);
    return getScoreboard(activeTournamentId);
  }, [activeTournamentId]);

  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchScoreboard);

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

  // Score bar calculation
  const teams = data?.teams ?? [];
  const totals = teams.map((t) => t.total).filter((v) => v !== null && v !== undefined);
  const best = totals.length ? Math.min(...totals) : 0;
  const worst = totals.length ? Math.max(...totals) : 0;
  const range = worst - best || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Scoreboard</h1>
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      </div>

      {/* Tournament selector */}
      <div className="flex gap-2 flex-wrap">
        {tournaments.map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams({ t: t.id })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              String(activeTournamentId) === String(t.id)
                ? 'bg-golf-green text-white border-golf-green'
                : 'bg-white text-gray-700 border-gray-200 hover:border-golf-green'
            }`}
          >
            {t.name}
          </button>
        ))}
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
              <span className="text-sm font-semibold text-white">
                {data.tournament?.name}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  data.tournament?.status === 'in'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-white/10 text-gray-300'
                }`}
              >
                {data.tournament?.status}
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
                      const barPct = team.total !== null
                        ? Math.round(((worst - team.total) / range) * 100)
                        : 0;
                      return (
                        <tr
                          key={team.team_id}
                          className={`hover:bg-gray-50 transition-colors ${
                            isLeader
                              ? 'bg-gradient-to-r from-amber-50 to-yellow-50/30 border-l-4 border-golf-gold'
                              : ''
                          }`}
                        >
                          <td className="px-5 py-3.5 text-sm">
                            <RankBadge rank={i + 1} />
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
                            <RoundScore val={team.rounds?.[1]} />
                          </td>
                          <td className="px-3 py-3.5 text-right text-sm">
                            <RoundScore val={team.rounds?.[2]} />
                          </td>
                          <td className="px-3 py-3.5 text-right text-sm">
                            <RoundScore val={team.rounds?.[3]} />
                          </td>
                          <td className="px-3 py-3.5 text-right text-sm">
                            <RoundScore val={team.rounds?.[4]} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {team.total === null ? (
                              <span className="text-gray-400 text-sm">—</span>
                            ) : (
                              <div className="inline-flex flex-col items-end gap-1">
                                <ScoreTag score={team.total} raw={team.total === 0 ? 'E' : String(team.total)} />
                                <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-1 rounded-full bg-golf-green"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
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
