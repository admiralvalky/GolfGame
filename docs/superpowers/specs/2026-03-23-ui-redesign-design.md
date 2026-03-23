# Golf Pool App — UI Redesign Spec
**Date:** 2026-03-23
**Status:** Approved
**Scope:** Full frontend redesign — all 6 pages + shared components

---

## Overview

Complete visual redesign of the Golf Pool app. The app is primarily used on mobile to check live tournament scores. The redesign moves from a light-background/dark-green-header pattern to a fully dark Golf Heritage theme, replaces the top navigation bar with a mobile-native bottom tab bar, and rebuilds the scoreboard with a hybrid row layout optimized for mobile readability.

No backend changes. No new features. Pure visual and UX improvement.

---

## Design Decisions

| Dimension | Decision | Rationale |
|---|---|---|
| Theme | Golf Heritage — full dark green | Sport-grounded, elevated, consistent with golf visual identity |
| Scoreboard rows | Hybrid Row — rank+total prominent, rounds as always-visible sub-row | Best of card (readable) + table (data density) without horizontal scroll |
| Player drawer | Inline rows — single line per player | Fast to scan, no extra tap needed |
| Navigation | Minimal top bar + bottom tab bar | Mobile-native ergonomics, maximizes content area |
| Home page | IS the leaderboard with tournament dropdown | Zero friction to scores; dropdown replaces separate /scoreboard route |
| Scoreboard route | `/scoreboard` redirects to `/` | Preserves deep links, no separate page needed |
| Picks route | BottomNav → `/picks`, page redirects to `/picks/:activeId` | No backend change; tournament selection handled client-side |

---

## Design System

### Color Tokens

Added to `tailwind.config.js` under `theme.extend.colors`:

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0d1f15` | App background (`body`) |
| `bg-surface` | `#1a3a2a` | Cards, rows |
| `bg-elevated` | `#0f2318` | Drawers, header, bottom nav |
| `border-subtle` | `#2d5a3d` | Dividers, card borders |
| `text-primary` | `#f0fdf4` | Team names, headings |
| `text-secondary` | `#86efac` | Labels, sub-text |
| `text-muted` | `#6ee7b7` | Timestamps, metadata |
| `text-faint` | `#4b7a5e` | Empty states, placeholders |
| `accent-gold` | `#d4af37` | #1 rank, leader highlight |
| `score-under` | `#4ade80` | Under-par scores (negative) |
| `score-over` | `#f87171` | Over-par scores (positive) |
| `score-even` | `#9ca3af` | Even par (E / 0) |
| `score-counting` | `#166534` | Background for counting rounds (best-2-of-4 highlight) |
| `score-counting-text` | `#bbf7d0` | Text on counting round badges |
| `error-surface` | `#2d1515` | Error state backgrounds |
| `error-text` | `#fca5a5` | Error state text |

### Typography Rules

- **Section labels:** `text-xs uppercase tracking-widest font-bold text-muted`
- **Page titles:** `text-xl font-bold tracking-tight text-primary`
- **Team names:** `font-semibold text-primary`
- **Scores:** `font-mono font-bold` + conditional color (see Score Coloring below)
- **Metadata / timestamps:** `text-xs text-muted`
- **Empty states:** `text-sm text-faint text-center`
- **Loading states:** `text-sm text-muted animate-pulse`

### Score Coloring Rule

Score values are always colored conditionally — applies to team totals, round scores, and player totals:

- `< 0` → `text-score-under`
- `> 0` → `text-score-over`
- `=== 0` or `"E"` → `text-score-even`
- CUT/WD/DQ/MDF → `text-faint` with strikethrough

### Icons

Bottom nav and any other icons use **emoji** (consistent with existing app convention: ⛳ 🏆 📊 ⚙️). No icon library added.

### `score-under` as CTA Color

`score-under` (`#4ade80`) doubles as the primary call-to-action / active-state color throughout the UI — active pill tabs, primary buttons (Save, Add), and active bottom nav tabs all use `bg-score-under text-black`. This is intentional: in a golf scoring context, the action color and the "good score" color being the same green is thematically coherent.

---

## Components

### New: `BottomNav`
Fixed bottom navigation bar with **4 tabs**.

| Tab | Icon | Label | Route |
|---|---|---|---|
| Scores | 🏆 | Scores | `/` |
| Season | 📊 | Season | `/season` |
| Picks | ⛳ | Picks | `/picks` |
| Setup | ⚙️ | Setup | `/setup` |

- Background: `bg-elevated`, 1px top border in `border-subtle`
- Active tab: icon + label in `score-under` green, `font-semibold`
- Inactive tab: icon + label in `gray-500`
- iOS safe area: `pb-safe` (or `padding-bottom: env(safe-area-inset-bottom)` via inline style)
- Replaces all nav links currently in `Layout.jsx`

### New: `HybridTeamRow`
Core scoreboard row. Used on Home and Scoreboard pages.

**Structure:**
```
[rank] [team name ──────────────────────] [total]
       R1: -12  R2: -11  R3: -10  R4: -9
```

**Rank badge colors:**
- `#1` → `text-accent-gold font-bold`
- `#2` → `text-gray-300 font-bold`
- `#3` → `text-amber-600 font-bold`
- Other → `text-gray-500`

**Leader row:** `border-l-2 border-accent-gold` left border, `bg-surface` background
**Other rows:** no left border, `bg-surface` background, `border-b border-subtle`

**Total score:** `font-mono font-bold text-2xl` + conditional score color
**Sub-row round scores:** `text-xs text-muted` each as `Rn: {score}` with conditional score color on the score value
**Tap behavior:** full row tappable, toggles expanded player drawer

### New: `PlayerInlineRow`
Single-line player row inside the expanded team drawer.

**Structure:**
```
[pos] [player name ────────────────] [thru] [R1] [R2] [R3] [R4] [total]
```

- Drawer background: `bg-elevated`, top border `border-subtle`
- Position (`T3`, `1`, etc.): `text-xs text-muted w-8`
- Player name: `text-sm font-medium text-primary flex-1`
- Thru (`F`, `14`, `-`): `text-xs text-muted` — always displays `F` for players in completed (historical) tournaments
- Round score badges: `text-xs px-1.5 py-0.5 rounded font-mono`
  - Non-counting round: `bg-surface text-secondary`
  - **Counting round (best-2-of-4):** `bg-score-counting text-score-counting-text font-bold` — preserves existing functional indicator
- Total: `font-mono font-bold text-sm` + conditional score color

**CUT/WD/DQ/MDF players:**
- Row: `opacity-40`
- Name: `line-through text-muted`
- Missing rounds: `—` in `text-faint`

### Updated: `ScoreTag`
Replace hardcoded color classes with new token equivalents. No structural changes.

### Updated: `LastUpdated`
Replace `text-gray-500`, `text-golf-green`, `text-golf-dark`, `text-gray-300` with `text-muted`, `text-secondary`, `text-primary` respectively. Refresh button styled with `bg-surface border border-subtle`.

### Updated: `PlayerPicker`
Updated in-place (not replaced). Replace all light-theme classes:
- `border-gray-300` → `border-subtle`
- `border-gray-200` → `border-subtle`
- `bg-golf-green/10` → `bg-surface`
- `hover:bg-gray-50` → `hover:bg-elevated`
- `bg-gray-100` → `bg-elevated`
- `text-blue-600` (selected count) → `text-accent-gold`
- Search input: `bg-elevated border-subtle` with green focus ring

### Updated: `ErrorBoundary`
Replace **all** hardcoded inline styles with dark-theme equivalents:
- Outer container: `background: '#2d1515'`, `border: '1px solid #7f1d1d'`, `borderRadius: '12px'`, `padding: '24px'`
- Heading/message text: `color: '#fca5a5'`
- Stack trace `<pre>`: `background: '#0d1f15'`, `color: '#86efac'`, `border: '1px solid #2d5a3d'`
- Reload button: `background: '#1a3a2a'`, `color: '#f0fdf4'`, `border: '1px solid #2d5a3d'`

### Updated: `Layout`
- Top bar: `bg-elevated`, 1px bottom border `border-subtle`
  - Left: `⛳ GOLF POOL` — `text-sm font-bold tracking-wide text-primary`
  - Right: `● LIVE` pill in `bg-green-800 text-green-300 text-xs` — visible only when tournament is active
- Body: flex column, `bg-base`, content area scrollable, bottom nav fixed
- `max-w-2xl mx-auto w-full` on content wrapper for desktop centering
- No nav links in top bar

---

## Pages

### Home (Scores Tab) — `/`

**Tournament selector:**
- Dropdown at top of page: `bg-elevated border border-subtle text-primary rounded-lg px-3 py-2 w-full`
- Lists all tournaments from DB, sorted by date descending
- Defaults to the active (in-progress) tournament, or most recent if none active
- Changing the dropdown updates the leaderboard below in-place (no page navigation)
- `/scoreboard` route redirects to `/` (React Router `<Navigate>` component)

**Active tournament state:**
- Tournament name (`text-xl font-bold text-primary`) + round + status label (`text-xs text-muted uppercase tracking-widest`) + live pill — displayed below the selector
- `HybridTeamRow` list for all teams, sorted by total score (ascending, best score first)
- Tap to expand: `PlayerInlineRow` list slides in below team's sub-row
- `LastUpdated` component at bottom of list
- Auto-refresh every 10 minutes via existing `useAutoRefresh` hook (only when viewing the active tournament; disabled for historical)

**No active tournament state:**
- Single card (`bg-surface rounded-xl p-6`) showing:
  - "Next Tournament" label in section label style
  - Tournament name in `text-xl font-bold text-primary`
  - Start date in `text-sm text-muted`
  - If no tournaments exist in DB: `text-faint` empty state — "No tournaments set up yet. Visit Setup to add one."

**Loading state:** skeleton rows — 3× `bg-surface animate-pulse rounded h-16` placeholders
**Error state:** `bg-error-surface border border-red-900 rounded-xl p-4 text-error-text` with message

### Scoreboard — `/scoreboard` → redirects to `/`
The Scoreboard page is merged into Home. `/scoreboard` renders a `<Navigate to="/" replace />` component to preserve any existing deep links. The Scoreboard page file is removed.

### Season — `/season`
- Section label: `SEASON STANDINGS`
- Dark-themed table: `bg-elevated` header row (`text-xs uppercase tracking-widest text-muted`), `bg-surface` data rows
- Row borders: `border-b border-subtle`
- Season leader row: `border-l-2 border-accent-gold`
- Tournament column names: abbreviated (≤8 chars) to minimize horizontal scroll
- Rank + team name columns sticky on left if horizontal scroll is needed on narrow screens
- Empty state: `text-faint` — "No completed tournaments yet."

### Picks — `/picks/:tournamentId`

**Route handling:** BottomNav links to `/picks` (no param). If no `tournamentId` param is present, the page fetches all tournaments and redirects to `/picks/:activeId` (active tournament, or most recent). This is a client-side redirect — no backend change.


- Pill team selector tabs: active `bg-score-under text-black font-semibold`, inactive `bg-surface text-secondary border border-subtle`
- Full-width search: `bg-elevated border border-subtle rounded-lg px-3 py-2 text-primary placeholder:text-faint w-full`
- Selection count badge: `text-xs font-bold px-2 py-0.5 rounded-full` — `bg-accent-gold text-black` when ≥4 selected, `bg-surface text-secondary` otherwise
- Player rows via updated `PlayerPicker` (see component section)
- CUT/WD players: grayed out (`opacity-50`), unselectable, sorted to bottom of list
- Save button: `bg-score-under text-black font-bold` when active, `opacity-50` when disabled

### Setup — `/setup`
- Two sections: Teams + Tournaments, separated by `border-t border-subtle`
- Team rows: `bg-surface rounded-lg` with team name (`text-primary`) + red delete button (`text-red-400 hover:text-red-300`)
- Delete confirmation: inline confirmation text ("Are you sure?") with confirm/cancel — no modal
- Add team: inline `bg-elevated` input + `bg-score-under text-black` "Add" button
- Tournament picker: year dropdown + tournament dropdown, both `bg-elevated border border-subtle text-primary`
- Save tournament button: `bg-score-under text-black font-bold`

### Team Detail — `/teams/:id`
- Added to redesign scope (cannot inherit dark theme automatically)
- Team header card: `bg-surface rounded-xl` with team name, rank badge, total score
- Round breakdown: horizontal flex of 4 round cards (`bg-elevated rounded-lg px-4 py-3`)
- Player table: dark-themed, inherits `PlayerInlineRow` pattern for consistency
- Error/loading states use same patterns as other pages

---

## Files Changed

| File | Change Type | Notes |
|---|---|---|
| `client/tailwind.config.js` | Update | Add all new color tokens |
| `client/src/index.css` | Update | `body` bg → `bg-base` (`#0d1f15`) |
| `client/src/components/Layout.jsx` | Rebuild | Slim top bar, bottom nav slot, flex layout |
| `client/src/components/BottomNav.jsx` | New | 4-tab bottom nav |
| `client/src/components/HybridTeamRow.jsx` | New | Team row with sub-row rounds |
| `client/src/components/PlayerInlineRow.jsx` | New | Single-line player row with counting-round highlight |
| `client/src/components/ScoreTag.jsx` | Update | Color token swap |
| `client/src/components/LastUpdated.jsx` | Update | Color token swap |
| `client/src/components/PlayerPicker.jsx` | Update | Full dark reskin in-place |
| `client/src/components/ErrorBoundary.jsx` | Update | Inline styles → dark colors |
| `client/src/pages/Home.jsx` | Rebuild | Live leaderboard, no active tournament fallback |
| `client/src/pages/Scoreboard.jsx` | Replace with redirect | `<Navigate to="/" replace />` only — functionality merged into Home |
| `client/src/App.jsx` (or router file) | Update | Add `/picks` → `/picks/:activeId` redirect logic; `/scoreboard` → `/` |
| `client/src/pages/Season.jsx` | Update | Dark table reskin |
| `client/src/pages/Picks.jsx` | Update | Pill tabs, dark search, updated PlayerPicker |
| `client/src/pages/Setup.jsx` | Update | Dark reskin |
| `client/src/pages/TeamDetail.jsx` | Update | Dark reskin, PlayerInlineRow for player table |

---

## Out of Scope

- Backend / API changes
- New features (push notifications, user accounts, etc.)
- Performance optimizations
- Changes to `api/` directory
- Custom font (using existing Tailwind sans-serif stack)
