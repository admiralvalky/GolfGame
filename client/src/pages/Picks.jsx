import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTeams, getTournaments, getEspnPlayers, getPicks, savePicks } from '../api.js';
import PlayerPicker from '../components/PlayerPicker.jsx';

export default function Picks() {
  const { tournamentId } = useParams();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [existingPicks, setExistingPicks] = useState({});
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, [tournamentId]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [tournamentsData, teamsData, picksData] = await Promise.all([
        getTournaments(),
        getTeams(),
        getPicks(tournamentId),
      ]);

      const t = tournamentsData.tournaments.find((x) => String(x.id) === String(tournamentId));
      if (!t) {
        setError('Tournament not found. Please add it in Setup first.');
        setLoading(false);
        return;
      }
      setTournament(t);
      setTeams(teamsData.teams);

      // Build existing picks map: team_id → [{player_espn_id, player_name}]
      const picksMap = {};
      for (const entry of picksData.picks) {
        picksMap[entry.team_id] = entry.players;
      }
      setExistingPicks(picksMap);

      // Fetch players from ESPN
      const playersData = await getEspnPlayers(t.espn_tournament_id);
      setPlayers(playersData.players);

      // Default to first team
      if (teamsData.teams.length > 0) {
        const firstId = teamsData.teams[0].id;
        setActiveTeamId(firstId);
        setSelectedPlayers(picksMap[firstId] ?? []);
      }
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTeam(teamId) {
    setActiveTeamId(teamId);
    setSelectedPlayers(existingPicks[teamId] ?? []);
    setSaveMsg('');
  }

  function handleTogglePlayer(player) {
    setSelectedPlayers((prev) => {
      const exists = prev.find((p) => p.player_espn_id === player.id);
      if (exists) {
        return prev.filter((p) => p.player_espn_id !== player.id);
      }
      if (prev.length >= 6) return prev;
      return [...prev, { player_espn_id: player.id, player_name: player.name }];
    });
    setSaveMsg('');
  }

  async function handleSave() {
    if (selectedPlayers.length !== 6) {
      setSaveMsg('You must pick exactly 6 players.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await savePicks({
        team_id: activeTeamId,
        tournament_id: parseInt(tournamentId, 10),
        players: selectedPlayers,
      });
      setExistingPicks((prev) => ({ ...prev, [activeTeamId]: selectedPlayers }));
      setSaveMsg('Picks saved!');
    } catch (err) {
      setSaveMsg(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-3">{error}</p>
        <Link to="/setup" className="text-golf-green underline text-sm">
          Go to Setup →
        </Link>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-3">No teams created yet.</p>
        <Link to="/setup" className="text-golf-green underline">Create teams in Setup →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pick Players</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tournament?.name}</p>
        </div>
        <Link to="/scoreboard" className="text-sm text-golf-green underline">
          View Scoreboard →
        </Link>
      </div>

      {/* Team selector */}
      <div className="flex gap-2 flex-wrap">
        {teams.map((team) => {
          const hasPicks = (existingPicks[team.id] ?? []).length === 6;
          return (
            <button
              key={team.id}
              onClick={() => handleSelectTeam(team.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                activeTeamId === team.id
                  ? 'bg-golf-green text-white border-golf-green'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-golf-green'
              }`}
            >
              {team.name}
              {hasPicks && (
                <span className="ml-1.5 text-xs opacity-75">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Player picker */}
      {activeTeamId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">
              {teams.find((t) => t.id === activeTeamId)?.name} — Pick 6 Players
            </h2>
          </div>

          <PlayerPicker
            players={players}
            selected={selectedPlayers}
            onToggle={handleTogglePlayer}
          />

          {/* Selected summary */}
          {selectedPlayers.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Selected Players:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPlayers.map((p) => (
                  <span
                    key={p.player_espn_id}
                    className="bg-golf-green/10 text-golf-dark text-xs px-2 py-1 rounded-full"
                  >
                    {p.player_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || selectedPlayers.length !== 6}
              className="bg-golf-green text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-golf-dark disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Picks'}
            </button>
            {saveMsg && (
              <span
                className={`text-sm ${
                  saveMsg === 'Picks saved!' ? 'text-golf-green' : 'text-red-500'
                }`}
              >
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
