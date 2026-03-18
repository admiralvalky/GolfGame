import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getTeams,
  createTeam,
  deleteTeam,
  getEspnSchedule,
  getTournaments,
  saveTournament,
} from '../api.js';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2024 }, (_, i) => 2025 + i);

export default function Setup() {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR >= 2025 ? CURRENT_YEAR : 2025);
  const [scheduleByYear, setScheduleByYear] = useState({});
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [savedTournaments, setSavedTournaments] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    loadTeams();
    loadSavedTournaments();
  }, []);

  useEffect(() => {
    loadSchedule(selectedYear);
  }, [selectedYear]);

  async function loadTeams() {
    const data = await getTeams();
    setTeams(data.teams);
  }

  async function loadSavedTournaments() {
    const data = await getTournaments();
    setSavedTournaments(data.tournaments);
  }

  async function loadSchedule(year) {
    if (scheduleByYear[year]) return; // already fetched
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const data = await getEspnSchedule(year);
      setScheduleByYear(prev => ({ ...prev, [year]: data.tournaments }));
    } catch (err) {
      setScheduleError('Could not load ESPN schedule. ' + err.message);
    } finally {
      setScheduleLoading(false);
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

  async function handleSaveTournament() {
    const schedule = scheduleByYear[selectedYear] ?? [];
    const t = schedule.find(t => t.id === selectedTournamentId);
    if (!t) return;
    await saveTournament({
      espn_tournament_id: t.id,
      name: t.name,
      start_date: t.startDate,
      end_date: t.endDate ?? null,
      status: t.status,
    });
    setSelectedTournamentId('');
    await loadSavedTournaments();
  }

  const savedIds = new Set(savedTournaments.map((t) => t.espn_tournament_id));
  const schedule = scheduleByYear[selectedYear] ?? [];
  const selectedTournament = schedule.find(t => t.id === selectedTournamentId) ?? null;

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
        <h2 className="text-lg font-semibold text-gray-700">Tournaments</h2>

        {/* Year + Tournament pickers */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={e => {
                setSelectedYear(Number(e.target.value));
                setSelectedTournamentId('');
              }}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-golf-green"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs text-gray-500 font-medium">Tournament</label>
            <select
              value={selectedTournamentId}
              onChange={e => setSelectedTournamentId(e.target.value)}
              disabled={scheduleLoading || schedule.length === 0}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-golf-green disabled:opacity-50"
            >
              <option value="">
                {scheduleLoading ? 'Loading…' : schedule.length === 0 ? 'No tournaments found' : 'Select a tournament…'}
              </option>
              {schedule.map(t => (
                <option key={t.id} value={t.id} disabled={savedIds.has(t.id)}>
                  {t.name}{savedIds.has(t.id) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedTournament && (
            savedIds.has(selectedTournament.id) ? (
              <span className="text-sm text-golf-green font-medium pb-2">✓ Already saved</span>
            ) : (
              <button
                onClick={handleSaveTournament}
                className="bg-golf-green text-white px-4 py-2 rounded text-sm font-medium hover:bg-golf-dark transition-colors"
              >
                Add
              </button>
            )
          )}
        </div>

        {scheduleError && (
          <p className="text-sm text-red-500 bg-red-50 rounded p-3">{scheduleError}</p>
        )}

        {/* Saved Tournaments */}
        {savedTournaments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">Saved Tournaments</h3>
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
      </section>
    </div>
  );
}
