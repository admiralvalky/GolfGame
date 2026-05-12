-- Supabase Schema Migration for Golf Pool App
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  espn_tournament_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'upcoming'
);

-- Picks (6 players per team per tournament)
CREATE TABLE IF NOT EXISTS picks (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_espn_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  UNIQUE(team_id, tournament_id, player_espn_id)
);

-- Tournament scores (legacy, mostly unused)
CREATE TABLE IF NOT EXISTS tournament_scores (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  final_score INTEGER NOT NULL,
  UNIQUE(tournament_id, team_id)
);

-- Cached player scores (persists ESPN data for historical tournaments)
CREATE TABLE IF NOT EXISTS cached_player_scores (
  espn_tournament_id TEXT NOT NULL,
  player_espn_id TEXT NOT NULL,
  rounds_json JSONB NOT NULL,
  thru TEXT,
  overall_status TEXT,
  total_score TEXT,
  rank TEXT,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (espn_tournament_id, player_espn_id)
);

-- Cached finalized team results for fast season standings.
CREATE TABLE IF NOT EXISTS cached_team_scores (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  total_score INTEGER,
  finish_rank INTEGER,
  pick_signature TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (tournament_id, team_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_picks_tournament ON picks(tournament_id);
CREATE INDEX IF NOT EXISTS idx_picks_team_tournament ON picks(team_id, tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_espn_id ON tournaments(espn_tournament_id);
CREATE INDEX IF NOT EXISTS idx_cached_scores_tournament ON cached_player_scores(espn_tournament_id);
CREATE INDEX IF NOT EXISTS idx_cached_team_scores_tournament ON cached_team_scores(tournament_id);

-- Atomic pick replacement used by api/picks/index.js. This keeps an existing
-- team entry intact if validation or insertion fails.
CREATE OR REPLACE FUNCTION replace_team_picks(
  p_team_id INTEGER,
  p_tournament_id INTEGER,
  p_players JSONB
)
RETURNS SETOF picks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_players) <> 'array' OR jsonb_array_length(p_players) <> 6 THEN
    RAISE EXCEPTION 'Exactly 6 players must be picked';
  END IF;

  IF (
    SELECT COUNT(DISTINCT player_espn_id)
    FROM jsonb_to_recordset(p_players) AS player(player_espn_id TEXT, player_name TEXT)
  ) <> 6 THEN
    RAISE EXCEPTION 'Duplicate players are not allowed';
  END IF;

  DELETE FROM picks
  WHERE team_id = p_team_id
    AND tournament_id = p_tournament_id;

  INSERT INTO picks (team_id, tournament_id, player_espn_id, player_name)
  SELECT
    p_team_id,
    p_tournament_id,
    player.player_espn_id,
    player.player_name
  FROM jsonb_to_recordset(p_players) AS player(player_espn_id TEXT, player_name TEXT);

  RETURN QUERY
  SELECT *
  FROM picks
  WHERE team_id = p_team_id
    AND tournament_id = p_tournament_id
  ORDER BY player_name;
END;
$$;
