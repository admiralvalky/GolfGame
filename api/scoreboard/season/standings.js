import supabase from '../../_lib/supabase.js';
import { fetchPlayerScores } from '../../_lib/espn.js';
import { computeTeamScoreByRound } from '../../_lib/scoring.js';
import { withEffectiveStatus } from '../../_lib/tournamentStatus.js';
import { withHandler } from '../../_lib/handler.js';

function pickSignature(picks) {
  return picks
    .map((p) => String(p.player_espn_id))
    .sort()
    .join('|');
}

function rankScores(scores) {
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
  return finishRanks;
}

export default withHandler(async function handler(req, res) {
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

  const { data: allPicks, error: picksError } = await supabase
    .from('picks')
    .select('*, teams!inner(id, name)');
  if (picksError) return res.status(500).json({ error: picksError.message });

  const { data: cachedRows, error: cachedError } = await supabase
    .from('cached_team_scores')
    .select('*');
  if (cachedError) {
    console.warn('Skipping cached team scores:', cachedError.message);
  }

  const picksByTournament = new Map();
  const pickCountsByTeam = {};
  for (const pick of allPicks ?? []) {
    if (!picksByTournament.has(pick.tournament_id)) {
      picksByTournament.set(pick.tournament_id, []);
    }
    picksByTournament.get(pick.tournament_id).push(pick);

    if (!pickCountsByTeam[pick.team_id]) pickCountsByTeam[pick.team_id] = {};
    const counts = pickCountsByTeam[pick.team_id];
    const key = pick.player_espn_id;
    if (!counts[key]) counts[key] = { name: pick.player_name, count: 0 };
    counts[key].count++;
  }

  const cachedByTournament = new Map();
  for (const row of cachedRows ?? []) {
    if (!cachedByTournament.has(row.tournament_id)) {
      cachedByTournament.set(row.tournament_id, []);
    }
    cachedByTournament.get(row.tournament_id).push(row);
  }

  const tournamentResults = [];

  for (const rawTournament of tournaments ?? []) {
    const tournament = withEffectiveStatus(rawTournament);
    const pickRows = picksByTournament.get(tournament.id) ?? [];

    const teamsMap = new Map();
    const picksByTeam = new Map();
    for (const row of pickRows ?? []) {
      if (!teamsMap.has(row.team_id)) {
        teamsMap.set(row.team_id, { id: row.teams.id, name: row.teams.name });
      }
      if (!picksByTeam.has(row.team_id)) picksByTeam.set(row.team_id, []);
      picksByTeam.get(row.team_id).push(row);
    }
    const teams = [...teamsMap.values()];

    if (teams.length === 0) continue;

    if (tournament.status === 'post') {
      const cached = cachedByTournament.get(tournament.id) ?? [];
      const cachedByTeam = new Map(cached.map((row) => [row.team_id, row]));
      const hasValidCache = teams.every((team) => {
        const row = cachedByTeam.get(team.id);
        return row && row.pick_signature === pickSignature(picksByTeam.get(team.id) ?? []);
      });

      if (hasValidCache) {
        const scores = {};
        const finishRanks = {};
        for (const team of teams) {
          const row = cachedByTeam.get(team.id);
          scores[team.id] = row.total_score;
          finishRanks[team.id] = row.finish_rank;
        }
        tournamentResults.push({ tournament, scores, finishRanks });
        continue;
      }
    }

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
      const picks = picksByTeam.get(team.id) ?? [];
      const { total } = computeTeamScoreByRound(picks ?? [], playerScores);
      scores[team.id] = total;
    }

    const finishRanks = rankScores(scores);

    if (tournament.status === 'post') {
      const now = new Date().toISOString();
      const cacheRows = teams.map((team) => ({
        tournament_id: tournament.id,
        team_id: team.id,
        total_score: scores[team.id] ?? null,
        finish_rank: finishRanks[team.id] ?? null,
        pick_signature: pickSignature(picksByTeam.get(team.id) ?? []),
        saved_at: now,
      }));
      if (cacheRows.length > 0) {
        const { error: cacheWriteError } = await supabase
          .from('cached_team_scores')
          .upsert(cacheRows, { onConflict: 'tournament_id,team_id' });
        if (cacheWriteError) {
          console.warn(`Failed to cache team scores for tournament ${tournament.id}:`, cacheWriteError.message);
        }
      }
    }

    tournamentResults.push({ tournament, scores, finishRanks });
  }

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

    const counts = pickCountsByTeam[team.id] ?? {};
    const entries = Object.values(counts);
    let mostPickedPlayers = [];
    if (entries.length > 0) {
      const max = Math.max(...entries.map((e) => e.count));
      mostPickedPlayers = entries
        .filter((e) => e.count === max)
        .map((e) => ({ name: e.name, count: max }))
        .sort((a, b) => a.name.localeCompare(b.name));
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
      mostPickedPlayers,
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
});
