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
 *
 * @param {Array<{player_espn_id: string, player_name: string}>} picks
 * @param {Map<string, {rounds: Record<number, string>}>} playerScoresMap
 * @returns {{ rounds: Object, total: number|null, players: Array }}
 */
export function computeTeamScoreByRound(picks, playerScoresMap) {
  // Build per-player round data
  const players = picks.map((pick) => {
    const entry = playerScoresMap.get(pick.player_espn_id);
    const rounds = entry?.rounds ?? {};
    const thru = entry?.thru ?? null;
    const overallStatus = entry?.overallStatus ?? '';
    return {
      player_espn_id: pick.player_espn_id,
      player_name: pick.player_name,
      rounds, // raw strings keyed by round number
      thru,
      overallStatus,
    };
  });

  const roundResults = {};
  let total = null;
  const countingByRound = {}; // round → Set of espn_ids

  for (let r = 1; r <= 4; r++) {
    // Collect eligible players for this round
    const eligible = [];
    for (const p of players) {
      const raw = p.rounds[r];
      const score = parseScore(raw);
      if (score !== null) {
        eligible.push({ player_espn_id: p.player_espn_id, score });
      }
    }

    if (eligible.length === 0) {
      // Round not yet played or no data
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

  // Annotate players with counting_rounds and eligible_rounds
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
