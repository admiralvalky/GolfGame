import { espnFetch } from '../../_lib/espn.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    res.json({ tournaments });
  } catch (err) {
    console.error('ESPN tournaments error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN tournaments', detail: err.message });
  }
}
