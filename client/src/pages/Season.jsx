import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSeasonStandings } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import LastUpdated from '../components/LastUpdated.jsx';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold flex-shrink-0">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-500 text-gray-200 text-xs font-bold flex-shrink-0">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-400 text-white text-xs font-bold flex-shrink-0">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pool-elevated text-pool-muted text-xs font-bold flex-shrink-0">{rank}</span>;
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

      {/* Column headers */}
      <div className="px-4 grid items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-pool-faint"
           style={{ gridTemplateColumns: '2rem 1fr repeat(3, 2rem) 3.5rem 3rem' }}>
        <span />
        <span>Team</span>
        <span className="text-center">🥇</span>
        <span className="text-center">🥈</span>
        <span className="text-center">🥉</span>
        <span className="text-right">Avg</span>
        <span className="text-right">Played</span>
      </div>

      <div className="bg-pool-elevated rounded-xl border border-pool-rim divide-y divide-pool-rim">
        {teams.map((team) => (
          <Link
            key={team.team_id}
            to={`/season/team/${team.team_id}`}
            className="grid items-center gap-2 px-4 py-3.5 hover:bg-pool-surface transition-colors"
            style={{ gridTemplateColumns: '2rem 1fr repeat(3, 2rem) 3.5rem 3rem' }}
          >
            <RankBadge rank={team.rank} />

            <span className={`font-semibold text-sm truncate ${team.rank === 1 ? 'text-pool-gold' : 'text-pool-primary'}`}>
              {team.team_name}
            </span>

            <span className="text-center text-sm font-mono font-bold text-pool-gold">
              {team.finishes[1] || '—'}
            </span>
            <span className="text-center text-sm font-mono text-pool-secondary">
              {team.finishes[2] || '—'}
            </span>
            <span className="text-center text-sm font-mono text-pool-muted">
              {team.finishes[3] || '—'}
            </span>

            <span className="text-right text-sm font-mono text-pool-muted">
              {team.avgFinish != null ? team.avgFinish : '—'}
            </span>
            <span className="text-right text-sm text-pool-faint">
              {team.played}
            </span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-pool-faint text-center">
        Tap a team to see their full season stats
      </p>
    </div>
  );
}
