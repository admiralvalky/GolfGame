import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/tournaments
router.get('/', (_req, res) => {
  const tournaments = db
    .prepare('SELECT * FROM tournaments ORDER BY start_date DESC')
    .all();
  res.json({ tournaments });
});

// POST /api/tournaments — save/activate a tournament
router.post('/', (req, res) => {
  const { espn_tournament_id, name, start_date, status } = req.body;
  if (!espn_tournament_id || !name) {
    return res.status(400).json({ error: 'espn_tournament_id and name are required' });
  }

  const existing = db
    .prepare('SELECT * FROM tournaments WHERE espn_tournament_id = ?')
    .get(espn_tournament_id);

  if (existing) {
    // Update status if it changed
    db.prepare('UPDATE tournaments SET status = ?, name = ? WHERE espn_tournament_id = ?').run(
      status ?? existing.status,
      name,
      espn_tournament_id
    );
    const updated = db
      .prepare('SELECT * FROM tournaments WHERE espn_tournament_id = ?')
      .get(espn_tournament_id);
    return res.json({ tournament: updated });
  }

  const result = db
    .prepare(
      'INSERT INTO tournaments (espn_tournament_id, name, start_date, status) VALUES (?, ?, ?, ?)'
    )
    .run(espn_tournament_id, name, start_date ?? null, status ?? 'upcoming');

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ tournament });
});

// PATCH /api/tournaments/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(status, req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ tournament });
});

export default router;
