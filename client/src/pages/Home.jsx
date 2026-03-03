import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, getTeams, getSeasonStandings } from '../api.js';

function StatusBadge({ status }) {
  const cfg = status === 'in'
    ? 'bg-green-400/30 text-green-100'
    : status === 'post'
    ? 'bg-white/20 text-white/70'
    : 'bg-yellow-400/30 text-yellow-100';
  const label = status === 'in' ? 'Live' : status === 'post' ? 'Completed' : 'Upcoming';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg}`}>{label}</span>;
}

function getTournamentWinner(seasonTeams, tournamentId) {
  let winner = null;
  let best = Infinity;
  for (const team of seasonTeams) {
    const score = team.byTournament?.[tournamentId];
    if (score != null && score < best) {
      best = score;
      winner = team.team_name;
    }
  }
  return winner;
}

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [seasonTeams, setSeasonTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTournaments(), getTeams(), getSeasonStandings()])
      .then(([t, tm, s]) => {
        setTournaments(t.tournaments);
        setTeams(tm.teams);
        setSeasonTeams(s.teams ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTournament = tournaments[0] ?? null;
  const heroTournament = tournaments[0] ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      {(() => {
        const heroContent = (
          <div className="relative bg-gradient-to-br from-golf-dark via-golf-green to-golf-fairway rounded-2xl p-8 text-white text-center shadow-lg overflow-hidden">
            <span className="absolute inset-0 flex items-center justify-center text-[8rem] opacity-5 pointer-events-none select-none">⛳</span>
            {heroTournament ? (
              <>
                <div className="relative flex items-center justify-center gap-2 mb-2">
                  <StatusBadge status={heroTournament.status} />
                </div>
                <h1 className="relative text-3xl sm:text-4xl font-bold mb-2">{heroTournament.name}</h1>
                <p className="relative text-golf-light font-medium text-sm">View Scoreboard →</p>
              </>
            ) : (
              <>
                <h1 className="relative text-3xl sm:text-4xl font-bold mb-2">⛳ Golf Pool</h1>
                <p className="relative text-golf-light font-semibold text-sm tracking-widest uppercase">
                  Pick 6 · Best 2 count · Lowest wins
                </p>
              </>
            )}
          </div>
        );
        return heroTournament
          ? <Link to="/scoreboard" className="block">{heroContent}</Link>
          : heroContent;
      })()}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/setup', icon: '⚙️', label: 'Setup', desc: 'Teams & tournaments' },
          {
            to: activeTournament ? `/picks/${activeTournament.id}` : '/setup',
            icon: '🏌️',
            label: 'Pick Players',
            desc: activeTournament ? activeTournament.name : 'No active tournament',
          },
          {
            to: activeTournament ? `/scoreboard` : '/setup',
            icon: '📊',
            label: 'Scoreboard',
            desc: 'Live standings',
          },
          { to: '/season', icon: '🏆', label: 'Season', desc: 'All-time standings' },
        ].map(({ to, icon, label, desc }) => (
          <Link
            key={label}
            to={to}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-golf-light hover:-translate-y-0.5 transition-all text-center"
          >
            <div className="bg-golf-green/10 rounded-xl w-10 h-10 flex items-center justify-center mx-auto mb-2 text-2xl">
              {icon}
            </div>
            <div className="font-semibold text-sm text-gray-800">{label}</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">{desc}</div>
          </Link>
        ))}
      </div>

      {/* Current State */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-golf-green p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🏆 Tournaments Played
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tournaments.length}
            </span>
          </h2>
          {tournaments.length === 0 ? (
            <p className="text-sm text-gray-400">
              No tournaments saved yet.{' '}
              <Link to="/setup" className="text-golf-green underline">
                Add one in Setup
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {tournaments.slice(0, 5).map((t) => {
                const winner = getTournamentWinner(seasonTeams, t.id);
                return (
                  <li key={t.id} className="flex items-start justify-between text-sm py-1">
                    <div>
                      <span className="text-gray-700">{t.name}</span>
                      {winner && t.status === 'post' && (
                        <div className="text-xs text-gray-400 mt-0.5">🏆 {winner}</div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ml-2 whitespace-nowrap ${
                        t.status === 'in'
                          ? 'bg-green-100 text-green-700'
                          : t.status === 'post'
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-golf-green p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            👥 Teams
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {teams.length}
            </span>
          </h2>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-400">
              No teams yet.{' '}
              <Link to="/setup" className="text-golf-green underline">
                Create one in Setup
              </Link>
            </p>
          ) : (
            <ul className="space-y-1.5">
              {teams.map((t) => (
                <li key={t.id} className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-golf-green" />
                  {t.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
