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
 * Compute a team's score for a tournament given a map of player scores.
 *
 * @param {Array<{player_espn_id: string, player_name: string}>} picks - team's 6 picks
 * @param {Map<string, string>} playerScores - map of espn_id → score string from ESPN
 * @returns {{ score: number|null, players: Array }} score and player details
 */
export function computeTeamScore(picks, playerScores) {
  const players = picks.map((pick) => {
    const rawScore = playerScores.get(pick.player_espn_id);
    const score = parseScore(rawScore);
    return {
      player_espn_id: pick.player_espn_id,
      player_name: pick.player_name,
      raw_score: rawScore ?? 'N/A',
      score,
      eligible: score !== null,
    };
  });

  const eligible = players.filter((p) => p.eligible).sort((a, b) => a.score - b.score);

  let teamScore = null;
  const counting = new Set();

  if (eligible.length >= 2) {
    teamScore = eligible[0].score + eligible[1].score;
    counting.add(eligible[0].player_espn_id);
    counting.add(eligible[1].player_espn_id);
  } else if (eligible.length === 1) {
    // Only 1 eligible player — partial score
    teamScore = eligible[0].score;
    counting.add(eligible[0].player_espn_id);
  }

  const playersWithCounting = players.map((p) => ({
    ...p,
    counting: counting.has(p.player_espn_id),
  }));

  return { score: teamScore, players: playersWithCounting };
}
