import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSeasonStandings } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 text-white text-sm font-bold flex-shrink-0">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-500 text-gray-200 text-sm font-bold flex-shrink-0">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-400 text-white text-sm font-bold flex-shrink-0">3</span>;
  return <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pool-surface text-pool-muted text-sm font-bold flex-shrink-0">{rank}</span>;
}

function Medal({ emoji, count }) {
  if (!count) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-pool-muted">
      <span>{emoji}</span>
      <span className="font-mono font-semibold text-pool-secondary">{count}</span>
    </span>
  );
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
  const completedCount = tournaments.filter((t) => t.status === 'post').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-pool-primary">Record Book</h1>
          <p className="text-sm text-pool-muted mt-0.5">
            {completedCount} tournament{completedCount !== 1 ? 's' : ''} completed · ranked by wins
          </p>
        </div>
        <LastUpdated timestamp={lastUpdated} onRefresh={refresh} loading={loading} />
      </div>

      <div className="bg-pool-elevated rounded-xl border border-pool-rim divide-y divide-pool-rim">
        {teams.map((team) => {
          const avg = team.avgScore;
          const avgDisplay = avg == null ? null : avg === 0 ? 'E' : avg > 0 ? `+${avg}` : String(avg);
const isLeader = team.rank === 1;
          const hasMedals = team.finishes[1] || team.finishes[2] || team.finishes[3];

          return (
            <Link
              key={team.team_id}
              to={`/season/team/${team.team_id}`}
              className="flex items-center gap-3 px-4 py-4 hover:bg-pool-surface transition-colors"
            >
              <RankBadge rank={team.rank} />

              {/* Name + stats block */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Row 1: team name */}
                <span className={`font-semibold text-base leading-tight ${isLeader ? 'text-pool-gold' : 'text-pool-primary'}`}>
                  {team.team_name}
                </span>

                {/* Row 2: medals + avg stats */}
                <div className="flex items-center gap-3">
                  {hasMedals ? (
                    <>
                      <Medal emoji="🥇" count={team.finishes[1]} />
                      <Medal emoji="🥈" count={team.finishes[2]} />
                      <Medal emoji="🥉" count={team.finishes[3]} />
                    </>
                  ) : (
                    <span className="text-xs text-pool-faint">No podium finishes</span>
                  )}
                  <div className="ml-auto flex flex-col items-end gap-0.5">
                    {avgDisplay && (
                      <span className="text-xs text-pool-faint">
                        Avg score <span className="font-mono text-pool-muted font-medium">{avgDisplay}</span>
                      </span>
                    )}
                    {team.avgFinish != null && (
                      <span className="text-xs text-pool-faint">
                        Avg finish <span className="font-mono text-pool-muted font-medium">{team.avgFinish}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chevron */}
              <span className="text-pool-faint text-xs flex-shrink-0">›</span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-pool-faint text-center">
        Tap a team to see their full season stats
      </p>
    </div>
  );
}
