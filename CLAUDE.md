# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

From `client/`:
```bash
npm run dev    # Vite dev server on port 5173 (frontend only; /api calls need vercel dev)
npm run build  # Production build → client/dist
```

For full-stack local dev (requires Vercel CLI: `npm i -g vercel`):
```bash
vercel dev     # Runs Vite frontend + Vercel Functions together on port 3000
```

No test suite exists yet.

> **Note**: The `server/` directory is the OLD Express + SQLite + Railway architecture. It is no longer deployed or used. Do not modify files in `server/`. All active backend code lives in `api/`.

## Architecture Overview

This is a golf pool app — users pick 6 players per tournament; the best 2 scores per round count toward the team total.

### Deployment

- **Frontend**: React SPA deployed to **Vercel** (static build from `client/dist`)
- **Backend**: **Vercel Serverless Functions** in `api/` directory
- **Database**: **Supabase** (PostgreSQL) — free tier, no persistent disk needed
- **Live URL**: the `golf-game` Vercel project (single project — `golf-game-7lhd` was a duplicate and has been deleted)

### Why Vercel + Supabase (not Railway + SQLite)

Migrated from Railway (paid, persistent disk required for SQLite) to Vercel + Supabase because both are free. Supabase provides a hosted PostgreSQL database accessible from Vercel's serverless functions via `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` env vars — no persistent disk or long-running server required.

### Data Flow

1. **Setup** (`/setup`): Admin saves a tournament (pulled from ESPN) to Supabase
2. **Picks** (`/picks/:tournamentId`): Each team selects 6 players from the ESPN live player list
3. **Home / Scoreboard** (`/`): Live team scores, auto-refreshes every 10 min during tournament window
4. **Team Detail** (`/team/:teamId`): Per-player breakdown showing which rounds count
5. **Season** (`/season`): Cumulative standings across all saved tournaments

### API (Vercel Functions — `api/`)

- `api/tournaments/index.js` — GET/POST/PATCH tournaments; auto-syncs ESPN status on GET
- `api/picks/index.js` — GET picks by tournament; POST replaces all picks atomically (6 required)
- `api/teams/index.js` — GET/POST/DELETE teams
- `api/scoreboard/index.js` — GET ranked team scores for a tournament (live ESPN data)
- `api/scoreboard/season/standings.js` — GET cumulative season standings
- `api/_lib/supabase.js` — Supabase client singleton (reads `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`)
- `api/_lib/espn.js` — ESPN fetch helpers: `fetchPlayerScores`, `extractThru`, `deriveOverallStatus`, `normalizeStatus`; falls back to Supabase `cached_player_scores` table if ESPN is unavailable
- `api/_lib/scoring.js` — Core scoring logic: `computeTeamScoreByRound` picks the best 2 eligible players per round

### Client (`client/src/`)

- `api.js` — All API calls; uses relative `/api` base URL (Vite proxies to `vercel dev` in local dev; same domain in production)
- `hooks/useAutoRefresh.js` — Polling hook; `intervalMs=null` disables polling
- `utils/tournament.js` — Date formatting and status label helpers

### Key Scoring Rule

**Best 2 of 6 per round**: `computeTeamScoreByRound` in `api/_lib/scoring.js` iterates rounds 1–4. For each round, it finds players with a valid (non-null, non-CUT) score, sorts ascending, and takes the lowest 2. Players with `eligible_rounds.length === 0` are fully muted in the UI.

### ESPN API

All score data comes from the ESPN scoreboard endpoint:
```
https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event={espnTournamentId}
```
The leaderboard endpoint is avoided — the scoreboard endpoint is more reliable. Per-round scores come from `competitor.linescores[].displayValue`. CUT/WD/MDF status must be inferred (see `deriveOverallStatus` in `api/_lib/espn.js`). Parsed scores are cached to the Supabase `cached_player_scores` table as a fallback.

### Supabase Tables

- `tournaments` — id, espn_tournament_id, name, start_date, end_date, status (`upcoming`/`in`/`post`)
- `teams` — id, name
- `picks` — team_id, tournament_id, player_espn_id, player_name
- `cached_player_scores` — espn_tournament_id, player_espn_id, rounds_json, thru, overall_status, total_score, rank, saved_at

### Custom Tailwind Tokens

Dark Golf Heritage theme (`pool.*` namespace):

```
pool-base        #0d1f15   App background (body)
pool-surface     #1a3a2a   Cards, rows
pool-elevated    #0f2318   Drawers, header, bottom nav
pool-rim         #2d5a3d   Borders, dividers
pool-primary     #f0fdf4   Headings, team names
pool-secondary   #86efac   Labels, sub-text
pool-muted       #6ee7b7   Timestamps, metadata
pool-faint       #4b7a5e   Empty states, placeholders
pool-gold        #d4af37   #1 rank, leader highlight
pool-under       #4ade80   Under-par scores; primary CTA color
pool-over        #f87171   Over-par scores
pool-even        #9ca3af   Even par (E / 0)
pool-counting    #166534   Counting-round badge background
pool-counting-fg #bbf7d0   Counting-round badge text
pool-err-bg      #2d1515   Error state backgrounds
pool-err-fg      #fca5a5   Error state text
```

`pool-under` (#4ade80) doubles as the primary CTA / active-state color (buttons, active tabs, active nav).

## Project Structure

The Golf Pool app repo is located at `~/Desktop/ClaudeCode/GolfGame/` (not the parent `ClaudeCode/` directory). Always `cd` into `GolfGame/` before running git commands.

## API Integration

When working with ESPN API data, **ALWAYS inspect the actual API response first** before writing parsing logic. Never guess at field names or data structure — use `curl` to fetch and log real responses:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event={espnTournamentId}" | jq . | head -100
```

Inspect the full structure before touching any parsing code in `api/_lib/espn.js`.

## Workflow

After implementing a fix, **verify it works by checking actual rendered/returned data before committing**. For UI fixes especially, test with real API data, not assumptions.

- Start the dev server (`vercel dev` from `GolfGame/`) and confirm the fix renders correctly
- For API/parsing fixes, `curl` the ESPN endpoint and confirm the parsed output matches expectations
- Never commit a fix that hasn't been verified against live or realistic data
