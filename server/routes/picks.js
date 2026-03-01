import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/picks/:tournamentId — all picks for a tournament
router.get('/:tournamentId', (req, res) => {
  const { tournamentId } = req.params;
  const picks = db
    .prepare(
      `SELECT p.*, t.name as team_name
       FROM picks p
       JOIN teams t ON t.id = p.team_id
       WHERE p.tournament_id = ?
       ORDER BY t.name, p.player_name`
    )
    .all(tournamentId);

  // Group by team
  const byTeam = {};
  for (const pick of picks) {
    if (!byTeam[pick.team_id]) {
      byTeam[pick.team_id] = { team_id: pick.team_id, team_name: pick.team_name, players: [] };
    }
    byTeam[pick.team_id].players.push({
      id: pick.id,
      player_espn_id: pick.player_espn_id,
      player_name: pick.player_name,
    });
  }

  res.json({ picks: Object.values(byTeam) });
});

// POST /api/picks — save picks for a team in a tournament
// Body: { team_id, tournament_id, players: [{player_espn_id, player_name}] }
router.post('/', (req, res) => {
  const { team_id, tournament_id, players } = req.body;

  if (!team_id || !tournament_id || !Array.isArray(players)) {
    return res.status(400).json({ error: 'team_id, tournament_id, and players array required' });
  }
  if (players.length !== 6) {
    return res.status(400).json({ error: 'Exactly 6 players must be picked' });
  }

  // Verify team and tournament exist
  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const tournament = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tournament_id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  // Replace existing picks for this team/tournament
  const deletePicks = db.prepare(
    'DELETE FROM picks WHERE team_id = ? AND tournament_id = ?'
  );
  const insertPick = db.prepare(
    'INSERT INTO picks (team_id, tournament_id, player_espn_id, player_name) VALUES (?, ?, ?, ?)'
  );

  const saveAll = db.transaction(() => {
    deletePicks.run(team_id, tournament_id);
    for (const p of players) {
      insertPick.run(team_id, tournament_id, p.player_espn_id, p.player_name);
    }
  });

  saveAll();

  const saved = db
    .prepare('SELECT * FROM picks WHERE team_id = ? AND tournament_id = ?')
    .all(team_id, tournament_id);

  res.status(201).json({ picks: saved });
});

export default router;
