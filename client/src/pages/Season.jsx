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

function formatScore(n) {
  if (n == null) return '—';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

/**
 * Compute head-to-head records from `byTournamentFinish` data.
 * Returns: { [teamId]: { [opponentId]: { wins, losses, ties } } }
 * A "win" = finished in a higher position (lower rank number) than opponent.
 */
function computeH2H(teams) {
  const records = {};
  for (const team of teams) {
    records[team.team_id] = {};
    for (const other of teams) {
      if (other.team_id !== team.team_id) {
        records[team.team_id][other.team_id] = { wins: 0, losses: 0, ties: 0 };
      }
    }
  }

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      const tournamentIds = new Set([
        ...Object.keys(a.byTournamentFinish ?? {}),
        ...Object.keys(b.byTournamentFinish ?? {}),
      ]);

      for (const tid of tournamentIds) {
        const rankA = a.byTournamentFinish?.[tid];
        const rankB = b.byTournamentFinish?.[tid];
        if (rankA == null || rankB == null) continue;
        if (rankA < rankB) {
          records[a.team_id][b.team_id].wins++;
          records[b.team_id][a.team_id].losses++;
        } else if (rankA > rankB) {
          records[b.team_id][a.team_id].wins++;
          records[a.team_id][b.team_id].losses++;
        } else {
          records[a.team_id][b.team_id].ties++;
          records[b.team_id][a.team_id].ties++;
        }
      }
    }
  }
  return records;
}

/** H2H matrix table — rows and cols are teams, cells show W-L record. */
function H2HMatrix({ teams }) {
  if (teams.length < 2) return null;
  const h2h = computeH2H(teams);
  const shortName = (name) => name.split(' ')[0]; // first word only for column headers

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-pool-primary uppercase tracking-wider">Head-to-Head</h2>
      <div className="overflow-x-auto rounded-xl border border-pool-rim">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-pool-rim">
              <th className="text-left px-3 py-2 text-pool-faint font-normal w-24 bg-pool-elevated">vs</th>
              {teams.map(t => (
                <th key={t.team_id} className="px-2 py-2 text-pool-muted font-semibold text-center bg-pool-elevated min-w-[3.5rem]">
                  {shortName(t.team_name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-pool-rim">
            {teams.map((row, ri) => (
              <tr key={row.team_id} className={ri % 2 === 0 ? 'bg-pool-elevated' : 'bg-pool-surface'}>
                <td className="px-3 py-2 text-pool-secondary font-semibold truncate max-w-[6rem]">
                  {shortName(row.team_name)}
                </td>
                {teams.map(col => {
                  if (col.team_id === row.team_id) {
                    return (
                      <td key={col.team_id} className="px-2 py-2 text-center text-pool-rim">
                        —
                      </td>
                    );
                  }
                  const r = h2h[row.team_id]?.[col.team_id];
                  if (!r) return <td key={col.team_id} className="px-2 py-2 text-center text-pool-faint">—</td>;
                  const hasData = r.wins + r.losses + r.ties > 0;
                  if (!hasData) return <td key={col.team_id} className="px-2 py-2 text-center text-pool-faint">—</td>;
                  return (
                    <td key={col.team_id} className="px-2 py-2 text-center font-mono">
                      <span className={r.wins > r.losses ? 'text-pool-under' : r.wins < r.losses ? 'text-pool-over' : 'text-pool-even'}>
                        {r.wins}-{r.losses}{r.ties > 0 ? `-${r.ties}` : ''}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-pool-faint">W-L per tournament. Green = winning record.</p>
    </div>
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

      {/* Season standings */}
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
                {/* Team name */}
                <span className={`font-semibold text-base leading-tight ${isLeader ? 'text-pool-gold' : 'text-pool-primary'}`}>
                  {team.team_name}
                </span>

                {/* Medals + avg stats */}
                <div className="flex items-center gap-3 flex-wrap">
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

                {/* Best pick highlight */}
                {team.bestPick && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-pool-gold">★</span>
                    <span className="text-pool-faint">Best pick:</span>
                    <span className="text-pool-secondary font-medium">{team.bestPick.playerName}</span>
                    <span className={`font-mono font-semibold ${team.bestPick.numericScore < 0 ? 'text-pool-under' : team.bestPick.numericScore === 0 ? 'text-pool-even' : 'text-pool-over'}`}>
                      {formatScore(team.bestPick.numericScore)}
                    </span>
                    <span className="text-pool-faint truncate">@ {team.bestPick.tournamentName}</span>
                  </div>
                )}
              </div>

              {/* Chevron */}
              <span className="text-pool-faint text-xs flex-shrink-0">›</span>
            </Link>
          );
        })}
      </div>

      {/* Head-to-head matrix — only show when 2+ completed tournaments exist */}
      {completedCount >= 1 && teams.length >= 2 && (
        <H2HMatrix teams={teams} />
      )}

      <p className="text-xs text-pool-faint text-center">
        Tap a team to see their full season stats
      </p>
    </div>
  );
}
