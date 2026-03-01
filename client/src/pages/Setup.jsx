import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getTeams,
  createTeam,
  deleteTeam,
  getEspnTournaments,
  getTournaments,
  saveTournament,
} from '../api.js';

export default function Setup() {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  const [espnTournaments, setEspnTournaments] = useState([]);
  const [savedTournaments, setSavedTournaments] = useState([]);
  const [espnLoading, setEspnLoading] = useState(true);
  const [espnError, setEspnError] = useState('');

  useEffect(() => {
    loadTeams();
    loadTournaments();
  }, []);

  async function loadTeams() {
    const data = await getTeams();
    setTeams(data.teams);
  }

  async function loadTournaments() {
    setEspnLoading(true);
    setEspnError('');
    try {
      const [espn, saved] = await Promise.all([getEspnTournaments(), getTournaments()]);
      setEspnTournaments(espn.tournaments);
      setSavedTournaments(saved.tournaments);
    } catch (err) {
      setEspnError('Could not load ESPN tournaments. ' + err.message);
    } finally {
      setEspnLoading(false);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setTeamLoading(true);
    setTeamError('');
    try {
      await createTeam(newTeamName.trim());
      setNewTeamName('');
      await loadTeams();
    } catch (err) {
      setTeamError(err.response?.data?.error ?? err.message);
    } finally {
      setTeamLoading(false);
    }
  }

  async function handleDeleteTeam(id) {
    if (!confirm('Delete this team and all their picks?')) return;
    await deleteTeam(id);
    await loadTeams();
  }

  async function handleSaveTournament(t) {
    await saveTournament({
      espn_tournament_id: t.id,
      name: t.name,
      start_date: t.startDate,
      status: t.status,
    });
    await loadTournaments();
  }

  const savedIds = new Set(savedTournaments.map((t) => t.espn_tournament_id));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Setup</h1>

      {/* Teams Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Teams</h2>

        <form onSubmit={handleCreateTeam} className="flex gap-2">
          <input
            type="text"
            placeholder="Team name…"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-golf-green"
          />
          <button
            type="submit"
            disabled={teamLoading || !newTeamName.trim()}
            className="bg-golf-green text-white px-4 py-2 rounded text-sm font-medium hover:bg-golf-dark disabled:opacity-50 transition-colors"
          >
            Add Team
          </button>
        </form>
        {teamError && <p className="text-red-500 text-sm">{teamError}</p>}

        {teams.length === 0 ? (
          <p className="text-sm text-gray-400">No teams yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-sm text-gray-800">{team.name}</span>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tournaments Section */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Tournaments</h2>
          <button
            onClick={loadTournaments}
            className="text-xs text-golf-green underline hover:text-golf-dark"
          >
            Refresh ESPN
          </button>
        </div>

        {espnError && (
          <p className="text-sm text-red-500 bg-red-50 rounded p-3">{espnError}</p>
        )}

        {espnLoading ? (
          <p className="text-sm text-gray-400">Loading ESPN tournaments…</p>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Available from ESPN
              </h3>
              {espnTournaments.length === 0 ? (
                <p className="text-sm text-gray-400">No tournaments found on ESPN.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {espnTournaments.map((t) => {
                    const isSaved = savedIds.has(t.id);
                    return (
                      <li key={t.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{t.name}</p>
                          <p className="text-xs text-gray-400">
                            {t.statusDetail || t.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSaved ? (
                            <span className="text-xs text-golf-green font-medium">✓ Saved</span>
                          ) : (
                            <button
                              onClick={() => handleSaveTournament(t)}
                              className="bg-golf-green text-white px-3 py-1 rounded text-xs hover:bg-golf-dark transition-colors"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {savedTournaments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Saved Tournaments
                </h3>
                <ul className="divide-y divide-gray-100">
                  {savedTournaments.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-800">{t.name}</span>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            t.status === 'in'
                              ? 'bg-green-100 text-green-700'
                              : t.status === 'post'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {t.status}
                        </span>
                        {teams.length > 0 && (
                          <Link
                            to={`/picks/${t.id}`}
                            className="text-xs text-golf-green underline hover:text-golf-dark"
                          >
                            Pick Players →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
