import supabase from '../../_lib/supabase.js';
import { fetchPlayerScores } from '../../_lib/espn.js';
import { computeTeamScoreByRound } from '../../_lib/scoring.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: true });

  const { data: allTeams } = await supabase
    .from('teams')
    .select('*')
    .order('name');

  if (!allTeams || allTeams.length === 0) {
    return res.json({ teams: [], tournaments: [] });
  }

  const tournamentResults = [];

  for (const tournament of tournaments ?? []) {
    // Get teams with picks for this tournament
    const { data: pickRows } = await supabase
      .from('picks')
      .select('team_id, teams!inner(id, name)')
      .eq('tournament_id', tournament.id);

    const teamsMap = new Map();
    for (const row of pickRows ?? []) {
      if (!teamsMap.has(row.team_id)) {
        teamsMap.set(row.team_id, { id: row.teams.id, name: row.teams.name });
      }
    }
    const teams = [...teamsMap.values()];

    if (teams.length === 0) continue;

    let playerScores;
    try {
      playerScores = await fetchPlayerScores(supabase, tournament.espn_tournament_id, tournament.status);
    } catch (err) {
      console.error(`Failed scores for tournament ${tournament.id}:`, err.message);
      tournamentResults.push({ tournament, scores: {} });
      continue;
    }

    const scores = {};
    for (const team of teams) {
      const { data: picks } = await supabase
        .from('picks')
        .select('*')
        .eq('team_id', team.id)
        .eq('tournament_id', tournament.id);

      const { total } = computeTeamScoreByRound(picks ?? [], playerScores);
      scores[team.id] = total;
    }

    tournamentResults.push({ tournament, scores });
  }

  // Build season totals
  const seasonTotals = allTeams.map((team) => {
    const byTournament = {};
    let total = 0;
    let played = 0;

    for (const { tournament, scores } of tournamentResults) {
      const s = scores[team.id];
      byTournament[tournament.id] = s ?? null;
      if (s !== null && s !== undefined) {
        total += s;
        played++;
      }
    }

    return { team_id: team.id, team_name: team.name, byTournament, total, played };
  });

  seasonTotals.sort((a, b) => {
    if (a.played === 0 && b.played === 0) return 0;
    if (a.played === 0) return 1;
    if (b.played === 0) return -1;
    return a.total - b.total;
  });

  let rank = 1;
  for (let i = 0; i < seasonTotals.length; i++) {
    if (i > 0 && seasonTotals[i].total !== seasonTotals[i - 1].total) rank = i + 1;
    seasonTotals[i].rank = rank;
  }

  res.json({
    teams: seasonTotals,
    tournaments: tournamentResults.map((t) => t.tournament),
  });
}
