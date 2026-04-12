import supabase from '../_lib/supabase.js';
import { fetchPlayerScores } from '../_lib/espn.js';
import { computeTeamScoreByRound } from '../_lib/scoring.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tournamentId = req.query.tournamentId;
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId query parameter required' });

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  // Get all teams with picks for this tournament
  const { data: pickRows } = await supabase
    .from('picks')
    .select('team_id, teams!inner(id, name)')
    .eq('tournament_id', tournamentId);

  // Dedupe teams
  const teamsMap = new Map();
  for (const row of pickRows ?? []) {
    if (!teamsMap.has(row.team_id)) {
      teamsMap.set(row.team_id, { id: row.teams.id, name: row.teams.name });
    }
  }
  const teams = [...teamsMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (teams.length === 0) {
    return res.json({ tournament, teams: [], lastUpdated: new Date().toISOString() });
  }

  let playerScores;
  let venue = { course: null, par: null };
  try {
    const result = await fetchPlayerScores(supabase, tournament.espn_tournament_id, tournament.status);
    playerScores = result.scoreMap;
    venue = result.venue ?? { course: null, par: null };
  } catch (err) {
    console.error('Failed to fetch ESPN scores:', err.message);
    return res.status(502).json({ error: 'Failed to fetch live scores from ESPN' });
  }

  const results = [];
  for (const team of teams) {
    const { data: picks } = await supabase
      .from('picks')
      .select('*')
      .eq('team_id', team.id)
      .eq('tournament_id', tournamentId);

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

  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].total !== results[i - 1].total) rank = i + 1;
    results[i].rank = rank;
  }

  res.json({
    tournament: { ...tournament, course: venue.course, par: venue.par },
    teams: results,
    lastUpdated: new Date().toISOString(),
  });
}
