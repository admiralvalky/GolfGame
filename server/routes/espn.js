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
      endDate: e.endDate ?? null,
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
 * Returns players + current scores for a specific tournament.
 * Uses the scoreboard endpoint with ?event= filter — the leaderboard endpoint
 * is unreliable; scoreboard always has the active competition data.
 */
router.get('/tournaments/:id/players', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cachedFetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${id}`
    );

    const competitors = data.events?.[0]?.competitions?.[0]?.competitors ?? [];

    const players = competitors.map((c) => {
      // score is a plain string: "-13", "+2", "E", "CUT", "WD", etc.
      const scoreVal = String(c.score ?? 'E');

      return {
        id: c.id,
        name: c.athlete?.displayName ?? 'Unknown',
        score: scoreVal,
        order: c.order ?? 999,
      };
    });

    // Sort by order (leaderboard position)
    players.sort((a, b) => a.order - b.order);

    res.json({ players, tournamentId: id });
  } catch (err) {
    console.error('ESPN players error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN players', detail: err.message });
  }
});

/**
 * GET /api/espn/tournaments/:id/details
 * Returns course name, par, purse, and location from ESPN core API.
 */
router.get('/tournaments/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await cachedFetch(
      `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${id}?lang=en&region=us`
    );
    const course = data.courses?.[0] ?? null;
    res.json({
      courseName: course?.name ?? null,
      par: course?.shotsToPar ?? null,
      purse: data.displayPurse ?? null,
      city: course?.address?.city ?? null,
      state: course?.address?.state ?? null,
    });
  } catch (err) {
    console.error('ESPN details error:', err.message);
    res.status(502).json({ error: 'Failed to fetch tournament details', detail: err.message });
  }
});

export default router;
