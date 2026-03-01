import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// In-memory cache: { key: { data, expiresAt } }
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function cachedFetch(url) {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
  });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  cache.set(url, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

/**
 * GET /api/espn/tournaments
 * Returns list of recent/active PGA tournaments from ESPN scoreboard
 */
router.get('/tournaments', async (req, res) => {
  try {
    const data = await cachedFetch(
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
    );

    const events = data.events ?? [];
    const tournaments = events.map((e) => ({
      id: e.id,
      name: e.name,
      shortName: e.shortName,
      startDate: e.date,
      status: e.status?.type?.name ?? 'unknown',
      statusDetail: e.status?.type?.detail ?? '',
    }));

    res.json({ tournaments });
  } catch (err) {
    console.error('ESPN tournaments error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN tournaments', detail: err.message });
  }
});

/**
 * GET /api/espn/tournaments/:id/players
 * Returns players + current scores for a specific tournament
 */
router.get('/tournaments/:id/players', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cachedFetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${id}`
    );

    const competitors = data.events?.[0]?.competitions?.[0]?.competitors ?? [];

    const players = competitors.map((c) => {
      const scoreVal = c.score?.displayValue ?? 'E';
      const statusName = c.status?.type?.name ?? '';
      const isCut = ['cut', 'wd', 'dq', 'mdf'].includes(statusName.toLowerCase());

      return {
        id: c.id,
        name: c.athlete?.displayName ?? c.displayName ?? 'Unknown',
        score: isCut ? statusName.toUpperCase() : scoreVal,
        status: statusName,
        position: c.status?.position?.displayName ?? c.standing?.displayValue ?? '',
      };
    });

    res.json({ players, tournamentId: id });
  } catch (err) {
    console.error('ESPN players error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN players', detail: err.message });
  }
});

export default router;
