import supabase from '../_lib/supabase.js';
import { fetchPlayerScores } from '../_lib/espn.js';
import { computeTeamScoreByRound } from '../_lib/scoring.js';
import { withEffectiveStatus } from '../_lib/tournamentStatus.js';
import { withHandler, parseIntParam } from '../_lib/handler.js';

export default withHandler(async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tournamentId = parseIntParam(req.query.tournamentId);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId must be a positive integer' });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  const effectiveTournament = withEffectiveStatus(tournament);

  const { data: pickRows, error: picksError } = await supabase
    .from('picks')
    .select('*, teams!inner(id, name)')
    .eq('tournament_id', tournamentId);
  if (picksError) return res.status(500).json({ error: picksError.message });

  const teamsMap = new Map();
  const picksByTeam = new Map();
  for (const row of pickRows ?? []) {
    if (!teamsMap.has(row.team_id)) {
      teamsMap.set(row.team_id, { id: row.teams.id, name: row.teams.name });
    }
    if (!picksByTeam.has(row.team_id)) picksByTeam.set(row.team_id, []);
    picksByTeam.get(row.team_id).push(row);
  }
  const teams = [...teamsMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (teams.length === 0) {
    return res.json({ tournament: effectiveTournament, teams: [], lastUpdated: new Date().toISOString() });
  }

  let playerScores;
  let venue = { course: null, par: null };
  try {
    const result = await fetchPlayerScores(supabase, effectiveTournament.espn_tournament_id, effectiveTournament.status);
    playerScores = result.scoreMap;
    venue = result.venue ?? { course: null, par: null };
  } catch (err) {
    console.error('Failed to fetch ESPN scores:', err.message);
    return res.status(502).json({ error: 'Failed to fetch live scores from ESPN' });
  }

  const results = [];
  for (const team of teams) {
    const picks = picksByTeam.get(team.id) ?? [];
    const { rounds, total, players } = computeTeamScoreByRound(picks ?? [], playerScores);
    const roundScores = {};
    for (let r = 1; r <= 4; r++) roundScores[r] = rounds[r]?.score ?? null;
    results.push({ team_id: team.id, team_name: team.name, total, rounds: roundScores, players });
  }

  // Best (lowest) numeric rank among a team's players — used as tiebreaker.
  // Player rank strings: "1", "T5", "T22". All-cut teams return Infinity.
  function bestPlayerRank(team) {
    let best = Infinity;
    for (const p of team.players ?? []) {
      if (!p.rank) continue;
      const n = parseInt(String(p.rank).replace('T', ''), 10);
      if (!isNaN(n) && n < best) best = n;
    }
    return best;
  }

  // Sort: lower total wins; null scores go last.
  // Tiebreaker 1: team with best (lowest) individual player rank wins.
  // Tiebreaker 2: alphabetical by team name.
  results.sort((a, b) => {
    if (a.total === null && b.total === null) return a.team_name.localeCompare(b.team_name);
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    if (a.total !== b.total) return a.total - b.total;
    const rankDiff = bestPlayerRank(a) - bestPlayerRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.team_name.localeCompare(b.team_name);
  });

  // Assign ranks sequentially — the sort above already resolves all ties via
  // tiebreaker, so every position in the sorted array gets its own unique rank.
  for (let i = 0; i < results.length; i++) {
    results[i].rank = i + 1;
  }

  res.json({
    tournament: { ...effectiveTournament, course: venue.course, par: venue.par },
    teams: results,
    lastUpdated: new Date().toISOString(),
  });
});
