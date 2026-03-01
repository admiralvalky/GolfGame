import { Router } from 'express';
import fetch from 'node-fetch';
import db from '../db.js';
import { computeTeamScore, parseScore } from '../scoring.js';

const router = Router();

// In-memory ESPN score cache (shared 10-min TTL)
const scoreCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchPlayerScores(espnTournamentId) {
  const now = Date.now();
  const cached = scoreCache.get(espnTournamentId);
  if (cached && cached.expiresAt > now) return cached.data;

  // Use scoreboard endpoint with event filter — more reliable than /leaderboard
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${espnTournamentId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
  });
  if (!res.ok) throw new Error(`ESPN error: ${res.status}`);

  const json = await res.json();
  const competitors = json.events?.[0]?.competitions?.[0]?.competitors ?? [];

  const scoreMap = new Map();
  for (const c of competitors) {
    // score is a plain string: "-13", "+2", "E", "CUT", "WD", etc.
    scoreMap.set(c.id, String(c.score ?? 'E'));
  }

  scoreCache.set(espnTournamentId, { data: scoreMap, expiresAt: now + CACHE_TTL_MS });
  return scoreMap;
}

/**
 * GET /api/scoreboard/:tournamentId
 * Returns ranked team scores for a given saved tournament
 */
router.get('/:tournamentId', async (req, res) => {
  const { tournamentId } = req.params;

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  // Get all teams with picks for this tournament
  const teams = db
    .prepare(
      `SELECT DISTINCT t.id, t.name
       FROM teams t
       JOIN picks p ON p.team_id = t.id
       WHERE p.tournament_id = ?
       ORDER BY t.name`
    )
    .all(tournamentId);

  if (teams.length === 0) {
    return res.json({ tournament, teams: [], lastUpdated: new Date().toISOString() });
  }

  let playerScores;
  try {
    playerScores = await fetchPlayerScores(tournament.espn_tournament_id);
  } catch (err) {
    console.error('Failed to fetch ESPN scores:', err.message);
    return res.status(502).json({ error: 'Failed to fetch live scores from ESPN' });
  }

  const results = teams.map((team) => {
    const picks = db
      .prepare('SELECT * FROM picks WHERE team_id = ? AND tournament_id = ?')
      .all(team.id, tournamentId);

    const { score, players } = computeTeamScore(picks, playerScores);
    return { team_id: team.id, team_name: team.name, score, players };
  });

  // Sort: lower score wins; null scores go last
  results.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });

  // Assign ranks (handle ties)
  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].score !== results[i - 1].score) rank = i + 1;
    results[i].rank = rank;
  }

  res.json({ tournament, teams: results, lastUpdated: new Date().toISOString() });
});

/**
 * GET /api/season
 * Season standings — cumulative scores across all saved tournaments
 */
router.get('/season/standings', async (req, res) => {
  const tournaments = db
    .prepare("SELECT * FROM tournaments ORDER BY start_date ASC")
    .all();

  const allTeams = db.prepare('SELECT * FROM teams ORDER BY name').all();

  if (allTeams.length === 0) {
    return res.json({ teams: [], tournaments: [] });
  }

  // For each tournament, compute each team's score
  const tournamentResults = [];

  for (const tournament of tournaments) {
    const teams = db
      .prepare(
        `SELECT DISTINCT t.id, t.name
         FROM teams t
         JOIN picks p ON p.team_id = t.id
         WHERE p.tournament_id = ?`
      )
      .all(tournament.id);

    if (teams.length === 0) continue;

    let playerScores;
    try {
      playerScores = await fetchPlayerScores(tournament.espn_tournament_id);
    } catch (err) {
      console.error(`Failed scores for tournament ${tournament.id}:`, err.message);
      tournamentResults.push({ tournament, scores: {} });
      continue;
    }

    const scores = {};
    for (const team of teams) {
      const picks = db
        .prepare('SELECT * FROM picks WHERE team_id = ? AND tournament_id = ?')
        .all(team.id, tournament.id);
      const { score } = computeTeamScore(picks, playerScores);
      scores[team.id] = score;
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

  // Sort by total ascending (lower is better in golf)
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
});

export default router;
