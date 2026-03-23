import { espnFetch } from '../_lib/espn.js';

const UA = 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const route = req.query.route ?? '';

  try {
    // GET /api/espn?route=tournaments
    if (route === 'tournaments') {
      const data = await espnFetch(
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
      return res.json({ tournaments });
    }

    // GET /api/espn?route=schedule&year=YYYY
    if (route === 'schedule') {
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const listRes = await fetch(
        `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/${year}/types/2/events?limit=200&lang=en&region=us`,
        { headers: { 'User-Agent': UA } }
      );
      if (!listRes.ok) throw new Error(`ESPN seasons list: ${listRes.status}`);
      const listData = await listRes.json();

      const eventIds = (listData.items ?? [])
        .map(ref => ref.$ref?.match(/\/events\/(\d+)/)?.[1])
        .filter(Boolean);

      const BATCH = 20;
      const tournaments = [];
      for (let i = 0; i < eventIds.length; i += BATCH) {
        const details = await Promise.all(
          eventIds.slice(i, i + BATCH).map(id =>
            fetch(
              `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${id}?lang=en&region=us`,
              { headers: { 'User-Agent': UA } }
            ).then(r => r.ok ? r.json() : null).catch(() => null)
          )
        );
        for (const d of details) {
          if (!d) continue;
          tournaments.push({
            id: String(d.id),
            name: d.name ?? d.shortName ?? 'Unknown',
            startDate: d.date ?? null,
            endDate: d.endDate ?? null,
            status: d.status?.type?.name ?? 'unknown',
            statusDetail: d.status?.type?.description ?? '',
          });
        }
      }
      tournaments.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      return res.json({ tournaments, year });
    }

    // GET /api/espn?route=players&id=XXX
    if (route === 'players') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id query parameter required' });
      const data = await espnFetch(
        `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${id}`
      );
      const competitors = data.events?.[0]?.competitions?.[0]?.competitors ?? [];
      const players = competitors.map((c) => ({
        id: c.id,
        name: c.athlete?.displayName ?? 'Unknown',
        score: String(c.score ?? 'E'),
        order: c.order ?? 999,
      }));
      players.sort((a, b) => a.order - b.order);
      return res.json({ players, tournamentId: id });
    }

    // GET /api/espn?route=details&id=XXX
    if (route === 'details') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id query parameter required' });
      const data = await espnFetch(
        `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${id}?lang=en&region=us`
      );
      const course = data.courses?.[0] ?? null;
      return res.json({
        courseName: course?.name ?? null,
        par: course?.shotsToPar ?? null,
        purse: data.displayPurse ?? null,
        city: course?.address?.city ?? null,
        state: course?.address?.state ?? null,
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('ESPN error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from ESPN', detail: err.message });
  }
}
