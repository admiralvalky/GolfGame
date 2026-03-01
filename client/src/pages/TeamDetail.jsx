import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getScoreboard, getTournaments } from '../api.js';
import { formatTournamentDates, statusLabel } from '../utils/tournament.js';

const CUT_STATUSES = ['CUT', 'WD', 'DQ', 'MDF', 'W/D'];

function TeamScoreCell({ val, className = '' }) {
  if (val === null || val === undefined) {
    return <span className="text-gray-300">—</span>;
  }
  const isOver = val > 0;
  return (
    <span className={`inline-block font-semibold font-mono px-2 py-0.5 rounded border border-gray-800 ${
      isOver
        ? 'bg-red-50 text-red-800'
        : 'bg-green-100 text-gray-900'
    } ${className}`}>
      {val === 0 ? 'E' : val > 0 ? `+${val}` : String(val)}
    </span>
  );
}

function RoundCell({ raw, counting, isCut }) {
  // Show CUT badge when round data is absent but player was cut
  if (raw == null && isCut) {
    return <span className="text-xs text-gray-400 font-medium">CUT</span>;
  }
  if (raw == null) return <span className="text-gray-300 text-sm">—</span>;
  const s = String(raw).trim().toUpperCase();
  const numeric = s === 'E' ? 0 : parseInt(s, 10);
  const isNum = !isNaN(numeric);
  return (
    <span
      className={`inline-block text-sm font-mono px-1 rounded ${
        counting
          ? 'bg-green-800 text-white font-semibold'
          : isNum && numeric > 0
          ? 'text-red-600'
          : 'text-gray-900'
      }`}
    >
      {raw}
    </span>
  );
}

function playerTotal(rounds) {
  let sum = null;
  for (let r = 1; r <= 4; r++) {
    const raw = rounds?.[r];
    if (raw == null) continue;
    const s = String(raw).trim().toUpperCase();
    const n = s === 'E' ? 0 : parseInt(s, 10);
    if (!isNaN(n)) {
      if (sum === null) sum = 0;
      sum += n;
    }
  }
  return sum;
}

export default function TeamDetail() {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('t');

  const [data, setData] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

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
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/scoreboard?t=${tournament.id}`} className="text-golf-green text-sm hover:underline">
            ← Scoreboard
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-800">{team.team_name}</h1>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-golf-green hover:text-golf-dark disabled:opacity-50 underline"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        )}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-center">
          <div className="h-1 bg-golf-green" />
          <div className="p-5">
            <div className="text-3xl font-bold mb-1">
              {team.total === null ? (
                <span className="text-gray-300">—</span>
              ) : (
                <TeamScoreCell val={team.total} className="text-3xl" />
              )}
            </div>
            <div className="text-xs text-gray-500">Team Score</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-center">
          <div className="h-1 bg-golf-green" />
          <div className="p-5">
            <div className="text-3xl font-bold text-gray-700 mb-1">
              {teamRank === 1 ? '🥇' : teamRank === 2 ? '🥈' : teamRank === 3 ? '🥉' : `#${teamRank}`}
            </div>
            <div className="text-xs text-gray-500">
              of {allTeams.length} teams
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-center col-span-2 sm:col-span-1">
          <div className="h-1 bg-golf-green" />
          <div className="p-5">
            <div className="text-sm font-semibold text-gray-700 mb-1 truncate">
              {tournament.name}
            </div>
            <div className="text-xs text-gray-500">
              {formatTournamentDates(tournament)}
            </div>
            <div className="text-xs mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-full ${
                statusLabel(tournament.status) === 'Live'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {statusLabel(tournament.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Round breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-1 bg-golf-green" />
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-600">Round Breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">R1</th>
                <th className="text-left px-5 py-3 font-medium">R2</th>
                <th className="text-left px-5 py-3 font-medium">R3</th>
                <th className="text-left px-5 py-3 font-medium">R4</th>
                <th className="text-left px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {[1, 2, 3, 4].map((r) => (
                  <td key={r} className="px-5 py-3">
                    <TeamScoreCell val={team.rounds?.[r]} />
                  </td>
                ))}
                <td className="px-5 py-3">
                  <TeamScoreCell val={team.total} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Player table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-600">Picked Players</span>
          <span className="ml-2 text-xs text-gray-400">
            (green fill = counting toward round score)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Player</th>
                <th className="text-center px-3 py-3 font-medium">Thru</th>
                <th className="text-center px-3 py-3 font-medium">R1</th>
                <th className="text-center px-3 py-3 font-medium">R2</th>
                <th className="text-center px-3 py-3 font-medium">R3</th>
                <th className="text-center px-3 py-3 font-medium">R4</th>
                <th className="text-center px-3 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {team.players?.map((player) => {
                const noEligible = player.eligible_rounds?.length === 0;
                const isCut = CUT_STATUSES.includes(player.overallStatus?.toUpperCase() ?? '');
                return (
                  <tr
                    key={player.player_espn_id}
                    className={`even:bg-gray-50/60 ${noEligible ? 'opacity-50' : ''}`}
                  >
                    <td className="px-5 py-3 text-sm">
                      <span className={noEligible ? 'line-through text-gray-500' : 'text-gray-800 font-medium'}>
                        {player.player_name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-gray-600">
                      {isCut
                        ? <span className="text-xs text-gray-400 font-medium">CUT</span>
                        : player.thru != null
                        ? player.thru
                        : '—'}
                    </td>
                    {[1, 2, 3, 4].map((r) => (
                      <td key={r} className="px-3 py-3 text-center">
                        <RoundCell
                          raw={player.rounds?.[r]}
                          counting={player.counting_rounds?.includes(r)}
                          isCut={isCut}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      {noEligible ? (
                        <span className="text-gray-300 text-sm">—</span>
                      ) : (
                        <TeamScoreCell val={playerTotal(player.rounds)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
