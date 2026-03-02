import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { seedDb } from './seed-db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? __dirname;
const dbPath = join(dataDir, 'golf.db');

// Seed the database from the bundled snapshot if starting fresh
if (!existsSync(dbPath)) {
  writeFileSync(dbPath, Buffer.from(seedDb, 'base64'));
  console.log('Seeded golf.db from snapshot.');
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    espn_tournament_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    start_date TEXT,
    status TEXT DEFAULT 'upcoming'
  );

  CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    tournament_id INTEGER NOT NULL,
    player_espn_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    UNIQUE(team_id, tournament_id, player_espn_id)
  );

  CREATE TABLE IF NOT EXISTS tournament_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    final_score INTEGER NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    UNIQUE(tournament_id, team_id)
  );
`);

try {
  db.exec(`ALTER TABLE tournaments ADD COLUMN end_date TEXT`);
} catch (_) { /* column already exists */ }

export default db;
