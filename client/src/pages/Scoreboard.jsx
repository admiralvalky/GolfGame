import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';
import ScoreTag from '../components/ScoreTag.jsx';

export default function Scoreboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);

  // Active tournament from URL param or default to first
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
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">
                {data.tournament?.name}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  data.tournament?.status === 'in'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
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
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium w-10">#</th>
                    <th className="text-left px-3 py-3 font-medium">Team</th>
                    <th className="text-right px-5 py-3 font-medium">Score</th>
                    <th className="text-right px-5 py-3 font-medium hidden sm:table-cell">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.teams.map((team, i) => (
                    <tr
                      key={team.team_id}
                      className={`hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-yellow-50/50' : ''}`}
                    >
                      <td className="px-5 py-3.5 text-sm font-bold text-gray-400">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : team.rank}
                      </td>
                      <td className="px-3 py-3.5">
                        <Link
                          to={`/team/${team.team_id}?t=${activeTournamentId}`}
                          className="font-semibold text-gray-800 hover:text-golf-green transition-colors text-sm"
                        >
                          {team.team_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {team.score === null ? (
                          <span className="text-gray-400 text-sm">—</span>
                        ) : (
                          <ScoreTag score={team.score} raw={team.score === 0 ? 'E' : String(team.score)} />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {team.players
                            ?.filter((p) => p.counting)
                            .map((p) => (
                              <span
                                key={p.player_espn_id}
                                className="text-xs bg-golf-green/10 text-golf-dark px-2 py-0.5 rounded-full"
                              >
                                {p.player_name.split(' ').slice(-1)[0]}
                                {' '}
                                <span className="font-mono">
                                  {p.raw_score}
                                </span>
                              </span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
