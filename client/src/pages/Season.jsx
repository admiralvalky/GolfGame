import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSeasonStandings } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';
import ScoreTag from '../components/ScoreTag.jsx';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-600 text-gray-200 text-xs font-bold">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-white text-xs font-bold">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pool-elevated text-pool-muted text-xs font-bold">{rank}</span>;
}

export default function Season() {
  const fetchStandings = useCallback(() => getSeasonStandings(), []);
  const { data, loading, error, lastUpdated, refresh } = useAutoRefresh(fetchStandings);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48 text-pool-muted">Loading…</div>;
  }

  if (error) {
    return (
      <div className="bg-pool-err-bg border border-red-900 rounded-xl p-6 text-pool-err-fg text-sm">
        {error}
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-pool-faint mb-3">No season data yet.</p>
        <p className="text-sm text-pool-faint">
          Create teams, add tournaments, and make picks to see standings.
        </p>
        <Link to="/setup" className="text-pool-under underline text-sm mt-3 block">
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
          <h1 className="text-2xl font-bold text-pool-primary">Season Standings</h1>
          <p className="text-sm text-pool-muted mt-0.5">
            {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} · Lower score wins
          </p>
        </div>
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      </div>

      <div className="bg-pool-elevated rounded-xl border border-pool-rim overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="bg-pool-elevated text-pool-muted text-xs uppercase tracking-wide">
              <th className="text-left px-2 sm:px-5 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-2 sm:px-3 py-2.5 font-medium">Team</th>
              {tournaments.map((t) => (
                <th
                  key={t.id}
                  className="text-right px-2 sm:px-3 py-2.5 font-medium"
                  title={t.name}
                >
                  <Link
                    to="/"
                    className="hover:text-pool-under transition-colors truncate block max-w-[60px] sm:max-w-[80px] ml-auto"
                  >
                    {t.name.length > 8 ? t.name.slice(0, 8) + '…' : t.name}
                  </Link>
                </th>
              ))}
              <th className="text-right px-2 sm:px-5 py-2.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pool-rim">
            {teams.map((team, i) => (
              <tr
                key={team.team_id}
                className={`hover:bg-pool-elevated transition-colors ${
                  i === 0
                    ? 'border-l-2 border-pool-gold bg-pool-surface'
                    : ''
                }`}
              >
                <td className="px-2 sm:px-5 py-3 text-sm">
                  <RankBadge rank={i + 1} />
                </td>
                <td className="px-2 sm:px-3 py-3 font-semibold text-sm text-pool-primary">
                  {team.team_name}
                </td>
                {tournaments.map((t) => {
                  const score = team.byTournament[t.id];
                  return (
                    <td key={t.id} className="px-2 sm:px-3 py-3 text-right">
                      {score === null || score === undefined ? (
                        <span className="text-pool-faint text-sm">—</span>
                      ) : (
                        <ScoreTag
                          score={score}
                          raw={score === 0 ? 'E' : String(score)}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-2 sm:px-5 py-3 text-right">
                  {team.played === 0 ? (
                    <span className="text-pool-faint text-sm">—</span>
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

      <p className="text-xs text-pool-faint text-center">
        Score = sum of 2 lowest player scores per tournament (CUT/WD players excluded)
      </p>
    </div>
  );
}
