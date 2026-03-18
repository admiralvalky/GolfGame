import { Router } from 'express';
import fetch from 'node-fetch';
import db from '../db.js';
import { computeTeamScoreByRound } from '../scoring.js';

const router = Router();

// In-memory ESPN score cache (shared TTL — 10 min live, 24 h for completed)
const scoreCache = new Map();

// Derive a normalized cut/wd/dq status from ESPN competitor data.
// ESPN stores this in status.type.description/name, not c.score.
// For the scoreboard endpoint, status is always {} so we infer from linescores.
function deriveOverallStatus(c, linescores, maxRound) {
  const desc = (c.status?.type?.description ?? '').toUpperCase();
  const name = (c.status?.type?.name ?? '').toUpperCase();
  if (desc.includes('CUT') || name.includes('CUT')) return 'CUT';
  if (desc.includes('WITHDRAW') || desc === 'WD' || name.includes('WD')) return 'WD';
  if (desc === 'DQ' || name.includes('DQ')) return 'DQ';
  if (desc === 'MDF' || name.includes('MDF')) return 'MDF';

  // Infer from linescore data (required for this ESPN endpoint where status is always {})
  if (linescores.length > 0) {
    const playerMaxRound = Math.max(...linescores.map(ls => ls.period));
    const allRoundsComplete = linescores.every(ls => (ls.linescores ?? []).length >= 18);
    if (allRoundsComplete) {
      if (maxRound >= 3 && playerMaxRound <= 2) return 'CUT';
      if (maxRound >= 4 && playerMaxRound === 3) return 'MDF';
    }
  }

  return String(c.score ?? '').trim().toUpperCase();
}

function extractThru(c, linescores) {
  if (c.status?.thru != null) return c.status.thru;
  const detail = c.status?.type?.shortDetail ?? '';
  // ESPN format: "-9 • T14" — T prefix + hole number
  const tMatch = detail.match(/\bT(\d+)\b/);
  if (tMatch) return Number(tMatch[1]);
  // Fallback: "Thru 14" or "9 Thru 14"
  const thruMatch = detail.match(/Thru\s+(\d+)/i);
  if (thruMatch) return Number(thruMatch[1]);
  // Finished: "F", "-9 • F", "Final", etc.
  if (/\b(F|Final)\b/i.test(detail)) return 'F';
  // State-based fallback: ESPN marks completed rounds as "post"
  if (c.status?.type?.state === 'post') return 'F';

  // Fallback: count nested hole linescores in the latest round
  if (linescores.length === 0) return null;
  const latestRound = linescores.reduce(
    (max, ls) => (ls.period > max.period ? ls : max),
    linescores[0]
  );
  const holesPlayed = (latestRound.linescores ?? []).length;
  if (holesPlayed === 0) return null;
  if (holesPlayed >= 18) return 'F';
  return holesPlayed;
}

function loadScoreMapFromDb(espnTournamentId) {
  const rows = db
    .prepare('SELECT * FROM cached_player_scores WHERE espn_tournament_id = ?')
    .all(espnTournamentId);
  if (rows.length === 0) return null;
  const scoreMap = new Map();
  for (const row of rows) {
    scoreMap.set(row.player_espn_id, {
      rounds: JSON.parse(row.rounds_json),
      thru: row.thru,
      overallStatus: row.overall_status ?? '',
      totalScore: row.total_score ?? '',
      rank: row.rank ?? null,
    });
  }
  return scoreMap;
}

function saveScoreMapToDb(espnTournamentId, scoreMap) {
  const upsert = db.prepare(`
    INSERT INTO cached_player_scores
      (espn_tournament_id, player_espn_id, rounds_json, thru, overall_status, total_score, rank, saved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(espn_tournament_id, player_espn_id) DO UPDATE SET
      rounds_json = excluded.rounds_json,
      thru = excluded.thru,
      overall_status = excluded.overall_status,
      total_score = excluded.total_score,
      rank = excluded.rank,
      saved_at = excluded.saved_at
  `);
  const now = new Date().toISOString();
  const insertAll = db.transaction((map) => {
    for (const [playerId, data] of map) {
      upsert.run(
        espnTournamentId,
        playerId,
        JSON.stringify(data.rounds),
        data.thru != null ? String(data.thru) : null,
        data.overallStatus ?? null,
        data.totalScore ?? null,
        data.rank ?? null,
        now
      );
    }
  });
  insertAll(scoreMap);
}

// Fetch per-round scores from ESPN's core API (used as fallback when the scoreboard
// API stops returning linescore displayValues for completed tournaments).
async function fetchRoundsFromCoreApi(espnTournamentId, playerIds) {
  const idSet = new Set(playerIds);
  const baseUrl = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${espnTournamentId}/competitions/${espnTournamentId}`;
  const competitorsUrl = `${baseUrl}/competitors?limit=300&lang=en&region=us`;

  const res = await fetch(competitorsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
  });
  if (!res.ok) throw new Error(`Core API competitors fetch failed: ${res.status}`);
  const json = await res.json();
  const allCompetitors = (json.items ?? []).filter(c => idSet.size === 0 || idSet.has(c.id));

  const roundsMap = new Map();
  const BATCH = 20;
  for (let i = 0; i < allCompetitors.length; i += BATCH) {
    await Promise.all(
      allCompetitors.slice(i, i + BATCH).map(async (comp) => {
        try {
          const lsRes = await fetch(`${baseUrl}/competitors/${comp.id}/linescores?lang=en&region=us`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
          });
          if (!lsRes.ok) return;
          const lsJson = await lsRes.json();
          const rounds = {};
          for (const ls of lsJson.items ?? []) {
            if (ls.period && ls.displayValue != null) {
              rounds[ls.period] = ls.displayValue.trim();
            }
          }
          roundsMap.set(comp.id, rounds);
        } catch (_) { /* skip individual player failures */ }
      })
    );
  }
  return roundsMap;
}

async function fetchPlayerScores(espnTournamentId, status = '') {
  const now = Date.now();
  const cached = scoreCache.get(espnTournamentId);
  if (cached && cached.expiresAt > now) return cached.data;

  // Use scoreboard endpoint with event filter — more reliable than /leaderboard
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${espnTournamentId}`;
  let competitors = [];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
    });
    if (res.ok) {
      const json = await res.json();
      competitors = json.events?.[0]?.competitions?.[0]?.competitors ?? [];
    }
  } catch (err) {
    console.error(`ESPN fetch failed for ${espnTournamentId}:`, err.message);
  }

  // If ESPN returned no data, fall back to DB cache
  if (competitors.length === 0) {
    const dbMap = loadScoreMapFromDb(espnTournamentId);
    if (dbMap && dbMap.size > 0) {
      console.log(`Using DB-cached scores for ESPN tournament ${espnTournamentId}`);
      scoreCache.set(espnTournamentId, { data: dbMap, expiresAt: now + 60 * 60 * 1000 });
      return dbMap;
    }
    throw new Error(`No score data available for ESPN tournament ${espnTournamentId}`);
  }

  // First pass: determine how far the tournament has progressed
  let maxRound = 0;
  for (const c of competitors) {
    for (const ls of c.linescores ?? []) {
      if (ls.period > maxRound) maxRound = ls.period;
    }
  }

  // Second pass: build scoreMap
  const scoreMap = new Map();
  for (const c of competitors) {
    const linescores = c.linescores ?? [];
    const rounds = {};
    for (const ls of linescores) {
      if (ls.period && ls.displayValue != null && ls.displayValue.trim() !== '') {
        rounds[ls.period] = ls.displayValue.trim();
      }
    }
    scoreMap.set(c.id, {
      rounds,
      thru: extractThru(c, linescores),
      overallStatus: deriveOverallStatus(c, linescores, maxRound),
      totalScore: String(c.score ?? '').trim(),
    });
  }

  // If the scoreboard API returned competitors but no round scores (ESPN strips
  // linescore displayValues for completed tournaments), fall back to the core API.
  const hasRoundData = [...scoreMap.values()].some(d => Object.keys(d.rounds).length > 0);
  if (!hasRoundData) {
    console.log(`Scoreboard API has no round data for ${espnTournamentId} — fetching from core API`);
    try {
      const coreRounds = await fetchRoundsFromCoreApi(espnTournamentId, [...scoreMap.keys()]);
      for (const [id, rounds] of coreRounds) {
        if (scoreMap.has(id)) scoreMap.get(id).rounds = rounds;
      }
    } catch (err) {
      console.error(`Core API fallback failed for ${espnTournamentId}:`, err.message);
    }
  }

  // Third pass: compute display ranks (e.g. "1", "T4") for active players
  const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);
  const active = [];
  for (const [id, data] of scoreMap) {
    if (!CUT_STATUSES.has(data.overallStatus)) {
      const s = data.totalScore.toUpperCase();
      const n = s === 'E' ? 0 : parseInt(s, 10);
      if (!isNaN(n)) active.push({ id, score: n });
    }
  }
  active.sort((a, b) => a.score - b.score);
  for (let i = 0; i < active.length; ) {
    let j = i;
    while (j < active.length && active[j].score === active[i].score) j++;
    const display = j - i > 1 ? `T${i + 1}` : String(i + 1);
    for (let k = i; k < j; k++) scoreMap.get(active[k].id).rank = display;
    i = j;
  }

  // Persist to DB so historical scores survive ESPN API expiry
  try {
    saveScoreMapToDb(espnTournamentId, scoreMap);
  } catch (err) {
    console.error('Failed to cache scores to DB:', err.message);
  }

  const TTL = status === 'post' ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000;
  scoreCache.set(espnTournamentId, { data: scoreMap, expiresAt: now + TTL });
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
    playerScores = await fetchPlayerScores(tournament.espn_tournament_id, tournament.status);
  } catch (err) {
    console.error('Failed to fetch ESPN scores:', err.message);
    return res.status(502).json({ error: 'Failed to fetch live scores from ESPN' });
  }

  const results = teams.map((team) => {
    const picks = db
      .prepare('SELECT * FROM picks WHERE team_id = ? AND tournament_id = ?')
      .all(team.id, tournamentId);

    const { rounds, total, players } = computeTeamScoreByRound(picks, playerScores);
    const roundScores = {};
    for (let r = 1; r <= 4; r++) roundScores[r] = rounds[r]?.score ?? null;
    return { team_id: team.id, team_name: team.name, total, rounds: roundScores, players };
  });

  // Sort: lower total wins; null scores go last
  results.sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return a.total - b.total;
  });

  // Assign ranks (handle ties)
  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].total !== results[i - 1].total) rank = i + 1;
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
      playerScores = await fetchPlayerScores(tournament.espn_tournament_id, tournament.status);
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
      const { total } = computeTeamScoreByRound(picks, playerScores);
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
