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
  try {
    playerScores = await fetchPlayerScores(supabase, tournament.espn_tournament_id, tournament.status);
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

  // Sort: lower total wins; null scores go last
  results.sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return a.total - b.total;
  });

  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].total !== results[i - 1].total) rank = i + 1;
    results[i].rank = rank;
  }

  res.json({ tournament, teams: results, lastUpdated: new Date().toISOString() });
}
