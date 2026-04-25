import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getEspnSchedule,
  getTournaments,
  saveTournament,
  deleteTournament,
} from '../api.js';
import AdminTokenControl from '../components/AdminTokenControl.jsx';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => 2024 + i);

function tournamentDisplayName(t) {
  if (!t) return '—';
  const year = t.start_date ? new Date(t.start_date).getFullYear() : null;
  const suffix = year ? ` '${String(year).slice(2)}` : '';
  return `${t.name}${suffix}`;
}

export default function Setup() {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const editInputRef = useRef(null);

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

  function startEditTeam(team) {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function cancelEditTeam() {
    setEditingTeamId(null);
    setEditingTeamName('');
  }

  async function handleRenameTeam(id) {
    const trimmed = editingTeamName.trim();
    if (!trimmed) return;
    try {
      await updateTeam(id, trimmed);
      setEditingTeamId(null);
      setEditingTeamName('');
      await loadTeams();
    } catch (err) {
      setTeamError(err.response?.data?.error ?? err.message);
    }
  }

  async function handleDeleteTeam(id) {
    if (!confirm('Delete this team and all their picks?')) return;
    await deleteTeam(id);
    await loadTeams();
  }

  async function handleDeleteTournament(id, name) {
    if (!confirm(`Delete "${name}" and all its picks?`)) return;
    await deleteTournament(id);
    await loadSavedTournaments();
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
      <h1 className="text-2xl font-bold text-pool-primary">Setup</h1>
      <AdminTokenControl />

      {/* Teams Section */}
      <section className="bg-pool-elevated rounded-xl border border-pool-rim p-6 space-y-4">
        <h2 className="text-lg font-semibold text-pool-primary">Teams</h2>

        <form onSubmit={handleCreateTeam} className="flex gap-2">
          <input
            type="text"
            placeholder="Team name…"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 bg-pool-surface border border-pool-rim text-pool-primary placeholder:text-pool-faint rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under"
          />
          <button
            type="submit"
            disabled={teamLoading || !newTeamName.trim()}
            className="bg-pool-under text-black px-4 py-2 rounded text-sm font-medium hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            Add Team
          </button>
        </form>
        {teamError && <p className="text-pool-over text-sm">{teamError}</p>}

        {teams.length === 0 ? (
          <p className="text-sm text-pool-faint">No teams yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-pool-rim">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center gap-2 py-2.5">
                {editingTeamId === team.id ? (
                  <>
                    <input
                      ref={editInputRef}
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTeam(team.id);
                        if (e.key === 'Escape') cancelEditTeam();
                      }}
                      className="flex-1 bg-pool-surface border border-pool-rim text-pool-primary rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under"
                    />
                    <button onClick={() => handleRenameTeam(team.id)} className="text-pool-under text-xs font-medium hover:text-green-400">Save</button>
                    <button onClick={cancelEditTeam} className="text-pool-muted text-xs hover:text-pool-primary">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-sm text-pool-primary">{team.name}</span>
                    <button onClick={() => startEditTeam(team)} className="text-pool-muted hover:text-pool-primary text-xs">Rename</button>
                    <button onClick={() => handleDeleteTeam(team.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tournaments Section */}
      <section className="bg-pool-elevated rounded-xl border border-pool-rim p-6 space-y-4">
        <h2 className="text-lg font-semibold text-pool-primary">Tournaments</h2>

        {/* Year + Tournament pickers */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-pool-muted font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={e => {
                setSelectedYear(Number(e.target.value));
                setSelectedTournamentId('');
              }}
              className="bg-pool-surface border border-pool-rim text-pool-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under disabled:opacity-50"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs text-pool-muted font-medium">Tournament</label>
            <select
              value={selectedTournamentId}
              onChange={e => setSelectedTournamentId(e.target.value)}
              disabled={scheduleLoading || schedule.length === 0}
              className="bg-pool-surface border border-pool-rim text-pool-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under disabled:opacity-50"
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
              <span className="text-sm text-pool-under font-medium pb-2">✓ Already saved</span>
            ) : (
              <button
                onClick={handleSaveTournament}
                className="bg-pool-under text-black px-4 py-2 rounded text-sm font-medium hover:bg-green-400 transition-colors"
              >
                Add
              </button>
            )
          )}
        </div>

        {scheduleError && (
          <p className="text-sm text-pool-over bg-pool-err-bg rounded p-3">{scheduleError}</p>
        )}

        {/* Saved Tournaments */}
        {savedTournaments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-pool-faint mb-3">Saved</h3>
            <ul className="divide-y divide-pool-rim">
              {savedTournaments.map((t) => (
                <li key={t.id} className="py-3 space-y-1.5">
                  <span className="block text-sm font-medium text-pool-primary leading-snug">{tournamentDisplayName(t)}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        t.status === 'in'
                          ? 'bg-pool-surface text-pool-under'
                          : t.status === 'post'
                          ? 'bg-pool-elevated text-pool-muted'
                          : 'bg-pool-elevated text-pool-gold'
                      }`}
                    >
                      {t.status === 'in' ? 'Live' : t.status === 'post' ? 'Final' : 'Upcoming'}
                    </span>
                    {teams.length > 0 && (
                      <Link
                        to={`/picks/${t.id}`}
                        className="text-xs text-pool-under hover:text-green-400"
                      >
                        Pick Players →
                      </Link>
                    )}
                    <button
                      onClick={() => handleDeleteTournament(t.id, t.name)}
                      className="text-red-400 hover:text-red-600 text-xs ml-auto"
                    >
                      Delete
                    </button>
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
