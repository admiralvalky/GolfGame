/**
 * Parse a golf score string to a numeric value.
 * "E" = 0, "-3" = -3, "+2" = 2, "CUT"/"WD"/"DQ" = null (excluded)
 */
export function parseScore(scoreStr) {
  if (scoreStr == null) return null;
  const s = String(scoreStr).trim().toUpperCase();
  if (s === 'E') return 0;
  if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'W/D') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * Compute a team's score per round using per-round ESPN linescore data.
 */
export function computeTeamScoreByRound(picks, playerScoresMap) {
  const players = picks.map((pick) => {
    const entry = playerScoresMap.get(pick.player_espn_id);
    const rounds = entry?.rounds ?? {};
    const thru = entry?.thru ?? null;
    const overallStatus = entry?.overallStatus ?? '';
    const rank = entry?.rank ?? null;
    return {
      player_espn_id: pick.player_espn_id,
      player_name: pick.player_name,
      rounds,
      thru,
      overallStatus,
      rank,
    };
  });

  const roundResults = {};
  let total = null;
  const countingByRound = {};

  for (let r = 1; r <= 4; r++) {
    const eligible = [];
    for (const p of players) {
      const raw = p.rounds[r];
      const score = parseScore(raw);
      if (score !== null) {
        eligible.push({ player_espn_id: p.player_espn_id, score });
      }
    }

    if (eligible.length === 0) {
      roundResults[r] = { score: null, players: [] };
      countingByRound[r] = new Set();
      continue;
    }

    eligible.sort((a, b) => a.score - b.score);
    const counting = eligible.slice(0, 2);
    const roundScore = counting.reduce((sum, p) => sum + p.score, 0);

    roundResults[r] = { score: roundScore, players: counting.map((p) => p.player_espn_id) };
    countingByRound[r] = new Set(counting.map((p) => p.player_espn_id));

    if (total === null) total = 0;
    total += roundScore;
  }

  const annotatedPlayers = players.map((p) => {
    const eligible_rounds = [];
    const counting_rounds = [];
    for (let r = 1; r <= 4; r++) {
      const raw = p.rounds[r];
      const score = parseScore(raw);
      if (score !== null) {
        eligible_rounds.push(r);
        if (countingByRound[r]?.has(p.player_espn_id)) {
          counting_rounds.push(r);
        }
      }
    }
    return { ...p, counting_rounds, eligible_rounds };
  });

  return { rounds: roundResults, total, players: annotatedPlayers };
}
