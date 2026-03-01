import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSeasonStandings } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';
import ScoreTag from '../components/ScoreTag.jsx';

export default function Season() {
  const fetchStandings = useCallback(() => getSeasonStandings(), []);
  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchStandings);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-3">No season data yet.</p>
        <p className="text-sm text-gray-400">
          Create teams, add tournaments, and make picks to see standings.
        </p>
        <Link to="/setup" className="text-golf-green underline text-sm mt-3 block">
          Go to Setup →
        </Link>
      </div>
    );
  }

  const { teams, tournaments } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Season Standings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} · Lower score wins
          </p>
        </div>
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium w-10">#</th>
              <th className="text-left px-3 py-3 font-medium">Team</th>
              {tournaments.map((t) => (
                <th
                  key={t.id}
                  className="text-right px-3 py-3 font-medium max-w-[100px]"
                  title={t.name}
                >
                  <Link
                    to={`/scoreboard?t=${t.id}`}
                    className="hover:text-golf-green transition-colors truncate block max-w-[80px] ml-auto"
                  >
                    {t.name.length > 12 ? t.name.slice(0, 12) + '…' : t.name}
                  </Link>
                </th>
              ))}
              <th className="text-right px-5 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teams.map((team, i) => (
              <tr
                key={team.team_id}
                className={`hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-yellow-50/50' : ''}`}
              >
                <td className="px-5 py-3.5 text-sm font-bold text-gray-400">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : team.rank}
                </td>
                <td className="px-3 py-3.5 font-semibold text-sm text-gray-800">
                  {team.team_name}
                </td>
                {tournaments.map((t) => {
                  const score = team.byTournament[t.id];
                  return (
                    <td key={t.id} className="px-3 py-3.5 text-right">
                      {score === null || score === undefined ? (
                        <span className="text-gray-300 text-sm">—</span>
                      ) : (
                        <ScoreTag
                          score={score}
                          raw={score === 0 ? 'E' : String(score)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-5 py-3.5 text-right">
                  {team.played === 0 ? (
                    <span className="text-gray-300 text-sm">—</span>
                  ) : (
                    <span className="font-bold text-sm">
                      <ScoreTag
                        score={team.total}
                        raw={team.total === 0 ? 'E' : String(team.total)}
                      />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Score = sum of 2 lowest player scores per tournament (CUT/WD players excluded)
      </p>
    </div>
  );
}
