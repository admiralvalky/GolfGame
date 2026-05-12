# Supabase

## Migrations

Each file in `migrations/` represents a schema change, named `YYYYMMDD_description.sql`.

Run them in order in the Supabase SQL Editor (Dashboard → SQL Editor → New Query). All statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` so they are safe to re-run.

| File | Description |
|------|-------------|
| `20240101_init.sql` | Initial schema: teams, tournaments, picks, cached scores, replace_team_picks RPC |

## Adding a migration

1. Create `migrations/YYYYMMDD_description.sql` (use today's date)
2. Write idempotent SQL (`IF NOT EXISTS`, `CREATE OR REPLACE`, etc.)
3. Run it in the Supabase SQL Editor
4. Commit the file

## Local dev

Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` (see `.env.example`).
