import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTournaments, getTeams } from '../api.js';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTournaments(), getTeams()])
      .then(([t, tm]) => {
        setTournaments(t.tournaments);
        setTeams(tm.teams);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTournament = tournaments[0] ?? null;

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
      <div className="bg-gradient-to-r from-golf-dark to-golf-green rounded-2xl p-8 text-white text-center shadow-lg">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">⛳ Golf Pool</h1>
        <p className="text-golf-light text-sm">
          Pick 6 players · Best 2 scores count · Lowest total wins
        </p>
      </div>

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
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-golf-light transition-all text-center"
          >
            <div className="text-2xl mb-1">{icon}</div>
            <div className="font-semibold text-sm text-gray-800">{label}</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">{desc}</div>
          </Link>
        ))}
      </div>

      {/* Current State */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🏌️ Saved Tournaments
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
              {tournaments.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700">{t.name}</span>
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
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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
