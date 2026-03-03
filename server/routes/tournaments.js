import { Router } from 'express';
import fetch from 'node-fetch';
import db from '../db.js';

const router = Router();

// Map ESPN raw status strings to normalized values used throughout the app
function normalizeStatus(raw) {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('FINAL') || s === 'POST') return 'post';
  if (s.includes('IN_PROGRESS') || s === 'IN') return 'in';
  return 'upcoming';
}

// Fetch current status for a tournament from ESPN and update the DB if it changed.
// Only runs for non-post tournaments to avoid unnecessary ESPN calls.
async function syncStatusFromEspn(tournament) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${tournament.espn_tournament_id}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const rawStatus = data.events?.[0]?.status?.type?.name ?? null;
    if (!rawStatus) return;
    const normalized = normalizeStatus(rawStatus);
    if (normalized !== tournament.status) {
      db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(normalized, tournament.id);
      tournament.status = normalized;
    }
  } catch (_) {
    // Non-fatal: just use the existing status
  }
}

// GET /api/tournaments
router.get('/', async (_req, res) => {
  const tournaments = db
    .prepare('SELECT * FROM tournaments ORDER BY start_date DESC')
    .all();

  // Normalize any raw ESPN status values and sync non-completed tournaments from ESPN
  await Promise.all(
    tournaments.map(async (t) => {
      const normalized = normalizeStatus(t.status);
      if (normalized !== t.status) {
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(normalized, t.id);
        t.status = normalized;
      }
      // Refresh live/upcoming statuses from ESPN in case they've changed
      if (t.status !== 'post') {
        await syncStatusFromEspn(t);
      }
    })
  );

  res.json({ tournaments });
});

// POST /api/tournaments — save/activate a tournament
router.post('/', (req, res) => {
  const { espn_tournament_id, name, start_date, end_date, status } = req.body;
  if (!espn_tournament_id || !name) {
    return res.status(400).json({ error: 'espn_tournament_id and name are required' });
  }

  const normalizedStatus = normalizeStatus(status);

  const existing = db
    .prepare('SELECT * FROM tournaments WHERE espn_tournament_id = ?')
    .get(espn_tournament_id);

  if (existing) {
    db.prepare('UPDATE tournaments SET status = ?, name = ?, end_date = ? WHERE espn_tournament_id = ?').run(
      normalizedStatus ?? existing.status,
      name,
      end_date ?? existing.end_date ?? null,
      espn_tournament_id
    );
    const updated = db
      .prepare('SELECT * FROM tournaments WHERE espn_tournament_id = ?')
      .get(espn_tournament_id);
    return res.json({ tournament: updated });
  }

  const result = db
    .prepare(
      'INSERT INTO tournaments (espn_tournament_id, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)'
    )
    .run(espn_tournament_id, name, start_date ?? null, end_date ?? null, normalizedStatus ?? 'upcoming');

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ tournament });
});

// PATCH /api/tournaments/:id/status
router.patch('/:id/status', (req, res) => {
  const { status, end_date } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const existing = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE tournaments SET status = ?, end_date = ? WHERE id = ?').run(
    normalizeStatus(status),
    end_date ?? existing?.end_date ?? null,
    req.params.id
  );
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ tournament });
});

export default router;
