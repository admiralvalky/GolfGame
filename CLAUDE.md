# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

From the repo root (`GolfGame/`):

```bash
npm run dev          # Start both server (port 3001) and client (port 5173) concurrently
npm run build        # Install all deps + build React app to client/dist
npm start            # Run Express server only (production mode)
```

From `server/`:
```bash
node --watch index.js   # Server with file watching
```

From `client/`:
```bash
npm run dev    # Vite dev server with /api proxy to localhost:3001
npm run build  # Production build → client/dist
```

No test suite exists yet.

## Architecture Overview

This is a golf pool app — users pick 6 players per tournament; the best 2 scores per round count toward the team total.

### Data Flow

1. **Setup** (`/setup`): Admin saves a tournament (pulled from ESPN) to the local SQLite DB
2. **Picks** (`/picks/:tournamentId`): Each team selects 6 players from the ESPN live player list
3. **Scoreboard** (`/scoreboard`): Live team scores, auto-refreshes every 10 min during tournament window
4. **Team Detail** (`/team/:teamId`): Per-player breakdown showing which rounds count
5. **Season** (`/season`): Cumulative standings across all saved tournaments

### Server (`server/`)

- `index.js` — Express entry point; in production, serves `client/dist` as static files with SPA fallback
- `db.js` — SQLite via `better-sqlite3`; DB path is `DATA_DIR` env var (defaults to `server/`); seeds from `seed-db.js` if no DB exists at startup
- `scoring.js` — Core scoring logic: `computeTeamScoreByRound` picks the best 2 eligible players per round, returning `counting_rounds` and `eligible_rounds` per player
- `routes/scoreboard.js` — The most complex route; fetches live ESPN linescore data, infers CUT/WD/MDF status (ESPN's status field is unreliable — status is inferred from linescore depth), computes team scores, assigns ranks
- `routes/espn.js` — Proxies ESPN scoreboard API with 10-min in-memory cache
- `routes/picks.js` — Always replaces all picks for a team/tournament atomically (6 players required)

### Client (`client/src/`)

- `api.js` — All API calls; uses relative `/api` base URL (works in both dev via Vite proxy and production via Express static serving)
- `hooks/useAutoRefresh.js` — Polling hook used by Scoreboard; `intervalMs=null` disables polling
- `utils/tournament.js` — Date formatting and status label helpers

### Key Scoring Rule

**Best 2 of 6 per round**: `computeTeamScoreByRound` in `scoring.js` iterates rounds 1–4. For each round, it finds players with a valid (non-null, non-CUT) score, sorts ascending, and takes the lowest 2. Players with `eligible_rounds.length === 0` are fully muted in the UI (CUT with no data).

### ESPN API

All score data comes from the ESPN scoreboard endpoint:
```
https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event={espnTournamentId}
```
The leaderboard endpoint is avoided — the scoreboard endpoint is more reliable. Per-round scores come from `competitor.linescores[].displayValue`. CUT/WD/MDF status must be inferred (see `deriveOverallStatus` in `scoreboard.js`).

### Deployment (Railway)

- Hosted at `https://precious-analysis-production.up.railway.app`
- Persistent volume mounted at `/data`; set `DATA_DIR=/data` env var
- `railway.json` configures build (`npm run build`) and start (`npm start`) commands
- `server/seed-db.js` contains the initial DB as base64; auto-written to `/data/golf.db` on first boot if missing

### Custom Tailwind Tokens

```
golf-green  #2d6a4f
golf-light  #52b788
golf-dark   #1b4332
golf-fairway #40916c
golf-gold   #d97706
```
