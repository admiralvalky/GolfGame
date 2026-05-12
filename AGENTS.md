# AGENTS.md

This file provides guidance to AI coding agents (Codex, Gemini CLI, etc.) working in this repository.
Claude Code users: see CLAUDE.md — it is the authoritative version of this file.

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
- **`scoring.js`** — `computeTeamScoreByRound(picks, playerScoresMap)`; `parseScore(str)`
- **`tournamentStatus.js`** — `withEffectiveStatus(tournament)` overrides DB status based on current date; `clampStatusByDate(status, start, end)`

## Supabase Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `tournaments` | id, espn_tournament_id, name, start_date, end_date, status | status: `upcoming`/`in`/`post` |
| `teams` | id, name | |
| `picks` | team_id, tournament_id, player_espn_id, player_name | 6 per team per tournament |
| `cached_player_scores` | espn_tournament_id, player_espn_id, rounds_json, thru, overall_status, total_score, rank, saved_at | post-tournament fallback |
| `cached_team_scores` | tournament_id, team_id, total_score, finish_rank, pick_signature, saved_at | season standings fast path |

Schema: `supabase/migrations/20240101_init.sql`

## Key Scoring Rule

`computeTeamScoreByRound`: for each of rounds 1–4, takes the 2 lowest-scoring eligible players. Players with `eligible_rounds.length === 0` are muted in the UI.

## ESPN Integration

### Endpoint
```
https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event={espnTournamentId}
```

### Critical gotcha: wrong-event substitution
The ESPN scoreboard silently returns the currently active tournament when given an expired/historical event ID. Always validate `data.events[0].id === espnTournamentId` and discard if they don't match.

### Before touching espn.js
```bash
curl "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=TOURNAMENT_ID" | jq . | head -100
```

## UI Theme

Dark Golf Heritage — Tailwind `pool.*` tokens. `pool-under` (#4ade80) is both the under-par color and the primary CTA/active-state color.

## Git / Deploy Workflow

- `master` → Vercel auto-deploys on every push
- Commit and push after every meaningful unit of work
- CI: `.github/workflows/ci.yml` runs `npm install && npm run build` on push/PR to master

## Workflow Rules

1. Verify before committing: run `vercel dev`, confirm with real data
2. Always `curl` ESPN endpoint before touching `espn.js`; never guess field names
3. All new API handlers: wrap with `withHandler()` from `api/_lib/handler.js`
