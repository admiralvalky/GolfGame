import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getScoreboard, getTournaments } from '../api.js';
import ScoreTag from '../components/ScoreTag.jsx';

export default function TeamDetail() {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('t');

  const [data, setData] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [teamId, tournamentId]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const tournamentsData = await getTournaments();
      setTournaments(tournamentsData.tournaments);

      const tid = tournamentId ?? tournamentsData.tournaments[0]?.id;
      if (!tid) {
        setError('No tournament found.');
        setLoading(false);
        return;
      }

      const scoreboard = await getScoreboard(tid);
      setData({
        team: scoreboard.teams.find((t) => String(t.team_id) === String(teamId)),
        tournament: scoreboard.tournament,
        allTeams: scoreboard.teams,
      });
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
        {error}
      </div>
    );
  }

  if (!data?.team) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-3">Team not found or has no picks.</p>
        <Link to="/scoreboard" className="text-golf-green underline">← Back to Scoreboard</Link>
      </div>
    );
  }

  const { team, tournament, allTeams } = data;
  const teamRank = team.rank;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={`/scoreboard?t=${tournament.id}`} className="text-golf-green text-sm hover:underline">
          ← Scoreboard
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-800">{team.team_name}</h1>
      </div>

      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              to={`/team/${teamId}?t=${t.id}`}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                String(t.id) === String(tournament.id)
                  ? 'bg-golf-green text-white border-golf-green'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-golf-green'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* Score summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold mb-1">
            {team.score === null ? '—' : (
              <ScoreTag score={team.score} raw={team.score === 0 ? 'E' : String(team.score)} />
            )}
          </div>
          <div className="text-xs text-gray-500">Team Score</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-gray-700 mb-1">
            {teamRank === 1 ? '🥇' : teamRank === 2 ? '🥈' : teamRank === 3 ? '🥉' : `#${teamRank}`}
          </div>
          <div className="text-xs text-gray-500">
            of {allTeams.length} teams
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center col-span-2 sm:col-span-1">
          <div className="text-sm font-semibold text-gray-700 mb-1 truncate">
            {tournament.name}
          </div>
          <div className="text-xs text-gray-500">{tournament.status}</div>
        </div>
      </div>

      {/* Player cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-600">Picked Players</span>
          <span className="ml-2 text-xs text-gray-400">
            (highlighted = counting toward team score)
          </span>
        </div>
        <div className="divide-y divide-gray-50">
          {team.players?.map((player) => (
            <div
              key={player.player_espn_id}
              className={`flex items-center justify-between px-5 py-3.5 ${
                player.counting ? 'bg-golf-green/5' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {player.counting ? (
                  <span className="w-6 h-6 rounded-full bg-golf-green text-white text-xs flex items-center justify-center">
                    ★
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-gray-200" />
                )}
                <span
                  className={`text-sm font-medium ${
                    !player.eligible ? 'text-gray-400 line-through' : 'text-gray-800'
                  }`}
                >
                  {player.player_name}
                </span>
                {!player.eligible && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {player.raw_score}
                  </span>
                )}
              </div>
              <div className="text-right">
                {player.eligible ? (
                  <ScoreTag score={player.score} raw={player.raw_score} />
                ) : (
                  <span className="text-gray-400 text-sm font-mono line-through">
                    {player.raw_score}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
