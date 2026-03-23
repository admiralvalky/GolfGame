import { espnFetch } from '../../../_lib/espn.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const data = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${id}`
    );

    const competitors = data.events?.[0]?.competitions?.[0]?.competitors ?? [];

    const players = competitors.map((c) => {
      const scoreVal = String(c.score ?? 'E');
      return {
        id: c.id,
        name: c.athlete?.displayName ?? 'Unknown',
        score: scoreVal,
        order: c.order ?? 999,
      };
    });

    players.sort((a, b) => a.order - b.order);
    res.json({ players, tournamentId: id });
  } catch (err) {
    console.error('ESPN players error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN players', detail: err.message });
  }
}
