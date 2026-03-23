import { espnFetch } from '../../../_lib/espn.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const data = await espnFetch(
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
}
