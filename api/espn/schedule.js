export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const UA = 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)';

  try {
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
    res.json({ tournaments, year });
  } catch (err) {
    console.error('ESPN schedule error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN schedule', detail: err.message });
  }
}
