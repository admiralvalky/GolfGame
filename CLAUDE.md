# CLAUDE.md

This file is loaded at every Claude Code session. Keep it accurate and concise.

## Repo Location

`~/ClaudeCode/GolfGame/` — always run git commands from here (not the parent directory).

## Development Commands

From repo root (npm workspaces — `client/` is a workspace):
```bash
npm install          # installs root + client deps in one step
npm run dev          # vercel dev on port 3000 (frontend + API together) ← use this
npm run build        # builds client/dist for production
npm run dev:client   # Vite only on port 5173 — NO API routes, only for pure UI work
```

> `vercel dev` is required for any work touching `/api` routes. `npm run dev:client` alone cannot call the API.

## Architecture

Golf pool app: users pick 6 players per tournament; best 2 scores per round count toward team total.

### Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18 + Vite + Tailwind | SPA in `client/src/` |
| Backend | Vercel Serverless Functions | `api/` directory |
| Database | Supabase (PostgreSQL) | Free tier |
| Deploy | Vercel | Auto-deploys `master` branch |

### Data Flow

1. **Setup** (`/setup`) — admin saves a tournament (pulled from ESPN) to Supabase
2. **Picks** (`/picks/:tournamentId`) — each team picks 6 players from ESPN live player list
3. **Home / Scoreboard** (`/`) — live team scores, auto-refreshes every 10 min during active window
4. **Team Detail** (`/team/:teamId`) — per-player breakdown showing which rounds count
5. **Season** (`/season`) — cumulative standings across all saved tournaments

## API Reference (`api/`)

### Endpoints

| File | Methods | Auth | Purpose |
|------|---------|------|---------|
| `tournaments/index.js` | GET POST PATCH DELETE | writes only | CRUD tournaments; POST upserts by ESPN ID |
| `picks/index.js` | GET POST | writes only | GET picks by tournament; POST atomically replaces all 6 picks |
| `teams/index.js` | GET POST PATCH DELETE | writes only | CRUD teams |
| `scoreboard/index.js` | GET | public | ranked team scores for a tournament (live ESPN) |
| `scoreboard/season/standings.js` | GET | public | cumulative season standings |
| `espn/index.js` | GET | public | ESPN proxy used by Setup page: `?route=tournaments\|schedule\|players\|details` |
| `keepalive.js` | GET | public | Vercel cron pings Supabase to prevent free-tier sleep |

**Auth model**: only POST/PATCH/PUT/DELETE require the admin token (`X-Admin-Token` header or `Authorization: Bearer`). GET endpoints are public. If `ADMIN_TOKEN` env var is unset, all writes are allowed (safe for local dev).

### Shared Libraries (`api/_lib/`)

- **`supabase.js`** — Supabase client singleton; reads `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
- **`auth.js`** — `requireAdmin(req, res)` — returns false and sends 401 if token check fails
- **`handler.js`** — `withHandler(fn)` wraps handlers to catch unhandled exceptions; `parseIntParam(val)` validates positive integer params; `isValidStatus(val)` checks against `upcoming|in|post`
- **`espn.js`** — all ESPN fetch logic (see ESPN section below)
- **`scoring.js`** — `computeTeamScoreByRound(picks, playerScoresMap)` — core scoring; `parseScore(str)` converts score strings to numbers
- **`tournamentStatus.js`** — `withEffectiveStatus(tournament)` overrides DB status based on current date (prevents stale `in` status after tournament ends); `clampStatusByDate(status, start, end)` applies same logic on write

## Supabase Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `tournaments` | id, espn_tournament_id, name, start_date, end_date, status | status: `upcoming`/`in`/`post` |
| `teams` | id, name | |
| `picks` | team_id, tournament_id, player_espn_id, player_name | 6 per team per tournament; unique on (team, tournament, player) |
| `cached_player_scores` | espn_tournament_id, player_espn_id, rounds_json, thru, overall_status, total_score, rank, saved_at | fallback when ESPN is unavailable post-tournament |
| `cached_team_scores` | tournament_id, team_id, total_score, finish_rank, pick_signature, saved_at | fast path for season standings on completed tournaments |

**RPC**: `replace_team_picks(p_team_id, p_tournament_id, p_players JSONB)` — atomically deletes then inserts picks in a transaction. Falls back to non-transactional delete+insert if RPC is missing.

Schema lives in `supabase/migrations/20240101_init.sql`. To apply to a new Supabase project: run the file in the SQL Editor (Dashboard → SQL Editor → New Query).

## Key Scoring Rule

`computeTeamScoreByRound` in `api/_lib/scoring.js`:
- Iterates rounds 1–4
- For each round: finds players with a valid (non-null, non-CUT/WD/DQ/MDF) score, sorts ascending, takes lowest 2
- Players with `eligible_rounds.length === 0` are fully muted in the UI (never counted in any round)

## ESPN Integration

### Endpoint used
```
https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event={espnTournamentId}
```
The leaderboard endpoint is avoided — the scoreboard endpoint is more reliable. Per-round scores come from `competitor.linescores[].displayValue`. CUT/WD/MDF status is inferred by `deriveOverallStatus`.

### Critical gotcha: wrong-event substitution
**The ESPN scoreboard silently returns the currently active tournament when given an expired/historical event ID.** `fetchPlayerScores` and `api/espn/index.js` both validate `data.events[0].id === espnTournamentId` and discard the response if they don't match. Never skip this check.

### Caching strategy
1. `post` tournaments → served from `cached_player_scores` (validated for R3/R4 data)
2. If cache empty or stale → try ESPN scoreboard
3. If ESPN returns 0 competitors → try DB cache again → then Core API
4. Core API (`sports.core.api.espn.com`) retains historical data indefinitely

### Before touching espn.js
Always `curl` the actual response first. Never guess field names:
```bash
curl "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=TOURNAMENT_ID" | jq . | head -100
```

## Client (`client/src/`)

- `api.js` — all API calls; uses relative `/api` base (same origin in both dev and prod via `vercel dev`)
- `hooks/useAutoRefresh.js` — polling hook; `intervalMs=null` disables
- `utils/tournament.js` — date formatting and status label helpers
- `pages/` — Home, Scoreboard, Picks, Setup, Season, TeamDetail, TeamSeasonStats
- `components/` — Layout, BottomNav, HybridTeamRow, PlayerInlineRow, PlayerPicker, ScoreTag, etc.

## UI Theme

Dark Golf Heritage theme — Tailwind `pool.*` token namespace:

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
pool-under       #4ade80   Under-par scores; also primary CTA / active-state color
pool-over        #f87171   Over-par scores
pool-even        #9ca3af   Even par (E / 0)
pool-counting    #166534   Counting-round badge background
pool-counting-fg #bbf7d0   Counting-round badge text
pool-err-bg      #2d1515   Error state backgrounds
pool-err-fg      #fca5a5   Error state text
```

## Git / Deploy Workflow

- `master` → Vercel auto-deploys to production on every push
- Feature work: create a branch, PR into `master`
- Commit and push after every meaningful unit of work
- No `production` branch needed — Vercel watches `master` directly
- CI runs on push/PR: `npm install && npm run build` (`.github/workflows/ci.yml`)

## Workflow Rules

1. **Verify before committing**: start `vercel dev`, confirm fix renders correctly with real data
2. **ESPN API**: always `curl` the endpoint and inspect the real response before touching `espn.js`
3. **No assumptions about ESPN field names** — structure changes silently; always verify
4. **All new API handlers**: wrap with `withHandler()` from `api/_lib/handler.js`; validate params with `parseIntParam()`
