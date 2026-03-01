import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/teams
router.get('/', (_req, res) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all();
  res.json({ teams });
});

// POST /api/teams
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' });
  }
  try {
    const result = db.prepare('INSERT INTO teams (name) VALUES (?)').run(name.trim());
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ team });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Team name already exists' });
    }
    throw err;
  }
});

// DELETE /api/teams/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM picks WHERE team_id = ?').run(id);
  db.prepare('DELETE FROM tournament_scores WHERE team_id = ?').run(id);
  db.prepare('DELETE FROM teams WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
