import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSeasonStandings } from '../api.js';
import ScoreTag from '../components/ScoreTag.jsx';

function ordinal(n) {
  if (n === 1) return '🥇 1st';
  if (n === 2) return '🥈 2nd';
  if (n === 3) return '🥉 3rd';
  if (n === 4) return '4th';
  return `${n}th`;
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="bg-pool-elevated border border-pool-rim rounded-xl p-4 flex flex-col items-center gap-1 flex-1 min-w-[4.5rem]">
      <span className={`text-xl font-bold font-mono ${highlight ? 'text-pool-gold' : 'text-pool-primary'}`}>
        {value ?? '—'}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-pool-faint text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function TeamSeasonStats() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSeasonStandings()
      .then(({ teams, tournaments: ts }) => {
        const found = teams.find((t) => String(t.team_id) === String(teamId));
        if (!found) {
          setError('Team not found.');
        } else {
          setTeam(found);
          setTournaments(ts);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-pool-muted">Loading…</div>;
  }

  if (error || !team) {
    return (
      <div className="bg-pool-err-bg border border-red-900 rounded-xl p-6 text-pool-err-fg text-sm">
        {error || 'Team not found.'}
      </div>
    );
  }

  // Build tournament history sorted most-recent first
  const history = [...tournaments]
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .map((t) => ({
      id: t.id,
      name: t.name,
      score: team.byTournament[t.id] ?? null,
      finish: team.byTournamentFinish[t.id] ?? null,
    }))
    .filter((t) => t.score !== null); // only show tournaments team participated in

  const avgScoreDisplay =
    team.avgScore != null
      ? team.avgScore === 0
        ? 'E'
        : team.avgScore > 0
        ? `+${team.avgScore}`
        : String(team.avgScore)
      : null;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link to="/season" className="inline-flex items-center gap-1 text-sm text-pool-muted hover:text-pool-primary transition-colors">
        ← Season
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pool-primary">{team.team_name}</h1>
        <p className="text-sm text-pool-muted mt-0.5">
          {team.played} tournament{team.played !== 1 ? 's' : ''} played
        </p>
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-2">
        <StatCard label="1st Place" value={team.finishes[1] || 0} highlight={team.finishes[1] > 0} />
        <StatCard label="2nd Place" value={team.finishes[2] || 0} />
        <StatCard label="3rd Place" value={team.finishes[3] || 0} />
        <StatCard label="Avg Finish" value={team.avgFinish ?? null} />
        <StatCard label="Avg Score" value={avgScoreDisplay} />
      </div>

      {/* Tournament history */}
      {history.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-pool-faint text-sm">No tournaments played yet.</p>
        </div>
      ) : (
        <div className="bg-pool-elevated rounded-xl border border-pool-rim overflow-hidden">
          {/* Table header */}
          <div className="grid px-4 py-2 border-b border-pool-rim text-[10px] font-semibold uppercase tracking-wide text-pool-faint"
               style={{ gridTemplateColumns: '1fr 5rem 5rem' }}>
            <span>Tournament</span>
            <span className="text-right">Score</span>
            <span className="text-right">Finish</span>
          </div>

          <div className="divide-y divide-pool-rim">
            {history.map((t) => (
              <div
                key={t.id}
                className="grid items-center px-4 py-3 gap-2"
                style={{ gridTemplateColumns: '1fr 5rem 5rem' }}
              >
                <span className="text-sm text-pool-primary truncate pr-2">{t.name}</span>

                <span className="text-right">
                  {t.score === null ? (
                    <span className="text-pool-faint text-sm">—</span>
                  ) : (
                    <ScoreTag score={t.score} raw={t.score === 0 ? 'E' : String(t.score)} />
                  )}
                </span>

                <span className={`text-right text-sm font-medium ${
                  t.finish === 1 ? 'text-pool-gold' :
                  t.finish === 2 ? 'text-gray-300' :
                  t.finish === 3 ? 'text-orange-300' :
                  'text-pool-muted'
                }`}>
                  {t.finish != null ? ordinal(t.finish) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
