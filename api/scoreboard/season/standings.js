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

  // Build per-tournament score maps
  const tournamentResults = [];

  for (const tournament of tournaments ?? []) {
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
      ({ scoreMap: playerScores } = await fetchPlayerScores(supabase, tournament.espn_tournament_id, tournament.status));
    } catch (err) {
      console.error(`Failed scores for tournament ${tournament.id}:`, err.message);
      tournamentResults.push({ tournament, scores: {}, finishRanks: {} });
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

    // Rank teams within this tournament (ties share rank, next rank skips)
    const finishRanks = {};
    const ranked = Object.entries(scores)
      .filter(([, s]) => s !== null && s !== undefined)
      .sort(([, a], [, b]) => a - b);
    let r = 1;
    for (let i = 0; i < ranked.length; ) {
      let j = i;
      while (j < ranked.length && ranked[j][1] === ranked[i][1]) j++;
      for (let k = i; k < j; k++) finishRanks[ranked[k][0]] = r;
      r = j + 1;
      i = j;
    }

    tournamentResults.push({ tournament, scores, finishRanks });
  }

  // Build per-team season stats
  const seasonTotals = allTeams.map((team) => {
    const byTournament = {};
    const byTournamentFinish = {};
    const finishes = { 1: 0, 2: 0, 3: 0 };
    let scoreSum = 0;
    let finishSum = 0;
    let played = 0;

    for (const { tournament, scores, finishRanks } of tournamentResults) {
      const score = scores[team.id];
      const finish = finishRanks[team.id];
      byTournament[tournament.id] = score ?? null;
      byTournamentFinish[tournament.id] = finish ?? null;

      if (score !== null && score !== undefined) {
        played++;
        scoreSum += score;
        if (finish !== undefined) {
          finishSum += finish;
          if (finish <= 3) finishes[finish] = (finishes[finish] ?? 0) + 1;
        }
      }
    }

    return {
      team_id: team.id,
      team_name: team.name,
      byTournament,
      byTournamentFinish,
      finishes,
      avgFinish: played > 0 ? Math.round((finishSum / played) * 10) / 10 : null,
      avgScore: played > 0 ? Math.round((scoreSum / played) * 10) / 10 : null,
      total: played > 0 ? scoreSum : null,
      played,
    };
  });

  // Sort by record-book criteria: wins → 2nds → 3rds → avg finish → avg score
  // Teams with 0 tournaments played rank last
  seasonTotals.sort((a, b) => {
    if (a.played === 0 && b.played === 0) return 0;
    if (a.played === 0) return 1;
    if (b.played === 0) return -1;
    if (b.finishes[1] !== a.finishes[1]) return b.finishes[1] - a.finishes[1];
    if (b.finishes[2] !== a.finishes[2]) return b.finishes[2] - a.finishes[2];
    if (b.finishes[3] !== a.finishes[3]) return b.finishes[3] - a.finishes[3];
    if (a.avgFinish !== b.avgFinish) return (a.avgFinish ?? 999) - (b.avgFinish ?? 999);
    return (a.avgScore ?? 999) - (b.avgScore ?? 999);
  });

  // Assign display ranks (ties share rank when wins+podiums+avgFinish all equal)
  let rank = 1;
  for (let i = 0; i < seasonTotals.length; i++) {
    if (i > 0) {
      const a = seasonTotals[i - 1];
      const b = seasonTotals[i];
      const tied =
        a.finishes[1] === b.finishes[1] &&
        a.finishes[2] === b.finishes[2] &&
        a.finishes[3] === b.finishes[3] &&
        a.avgFinish === b.avgFinish &&
        a.avgScore === b.avgScore;
      if (!tied) rank = i + 1;
    }
    seasonTotals[i].rank = rank;
  }

  res.json({
    teams: seasonTotals,
    tournaments: tournamentResults.map((t) => t.tournament),
  });
}
