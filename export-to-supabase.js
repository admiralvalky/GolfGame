/**
 * Export SQLite data to SQL INSERT statements for Supabase import.
 *
 * Usage: node export-to-supabase.js > import.sql
 *
 * Then paste the output into Supabase SQL Editor.
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? join(__dirname, 'server');
const dbPath = join(dataDir, 'golf.db');

const db = new Database(dbPath, { readonly: true });

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

console.log('-- Golf Pool: SQLite → Supabase data export');
console.log('-- Generated at:', new Date().toISOString());
console.log('');

// Teams
const teams = db.prepare('SELECT * FROM teams ORDER BY id').all();
if (teams.length > 0) {
  console.log('-- Teams');
  for (const t of teams) {
    console.log(`INSERT INTO teams (id, name) VALUES (${t.id}, ${escape(t.name)}) ON CONFLICT (id) DO NOTHING;`);
  }
  const maxTeamId = Math.max(...teams.map(t => t.id));
  console.log(`SELECT setval('teams_id_seq', ${maxTeamId});`);
  console.log('');
}

// Tournaments
const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY id').all();
if (tournaments.length > 0) {
  console.log('-- Tournaments');
  for (const t of tournaments) {
    console.log(
      `INSERT INTO tournaments (id, espn_tournament_id, name, start_date, end_date, status) VALUES (${t.id}, ${escape(t.espn_tournament_id)}, ${escape(t.name)}, ${escape(t.start_date)}, ${escape(t.end_date)}, ${escape(t.status)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  const maxTournamentId = Math.max(...tournaments.map(t => t.id));
  console.log(`SELECT setval('tournaments_id_seq', ${maxTournamentId});`);
  console.log('');
}

// Picks
const picks = db.prepare('SELECT * FROM picks ORDER BY id').all();
if (picks.length > 0) {
  console.log('-- Picks');
  for (const p of picks) {
    console.log(
      `INSERT INTO picks (id, team_id, tournament_id, player_espn_id, player_name) VALUES (${p.id}, ${p.team_id}, ${p.tournament_id}, ${escape(p.player_espn_id)}, ${escape(p.player_name)}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  const maxPickId = Math.max(...picks.map(p => p.id));
  console.log(`SELECT setval('picks_id_seq', ${maxPickId});`);
  console.log('');
}

// Cached player scores
const cached = db.prepare('SELECT * FROM cached_player_scores').all();
if (cached.length > 0) {
  console.log('-- Cached player scores');
  for (const c of cached) {
    // rounds_json is stored as TEXT in SQLite; Supabase expects JSONB
    const roundsJsonb = escape(c.rounds_json);
    console.log(
      `INSERT INTO cached_player_scores (espn_tournament_id, player_espn_id, rounds_json, thru, overall_status, total_score, rank, saved_at) VALUES (${escape(c.espn_tournament_id)}, ${escape(c.player_espn_id)}, ${roundsJsonb}::jsonb, ${escape(c.thru)}, ${escape(c.overall_status)}, ${escape(c.total_score)}, ${escape(c.rank)}, ${escape(c.saved_at)}) ON CONFLICT (espn_tournament_id, player_espn_id) DO NOTHING;`
    );
  }
  console.log('');
}

console.log('-- Export complete');
db.close();
