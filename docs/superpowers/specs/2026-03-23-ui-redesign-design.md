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
| Home page | IS the live leaderboard | Zero friction to the most-checked screen |

---

## Design System

### Color Tokens

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0d1f15` | App background |
| `bg-surface` | `#1a3a2a` | Cards, rows |
| `bg-elevated` | `#0f2318` | Drawers, header, bottom nav |
| `border` | `#2d5a3d` | Dividers, card borders |
| `text-primary` | `#f0fdf4` | Team names, headings |
| `text-secondary` | `#86efac` | Labels, sub-text |
| `text-muted` | `#6ee7b7` | Timestamps, metadata |
| `accent-gold` | `#d4af37` | #1 rank, leader highlight |
| `score-under` | `#4ade80` | Under-par scores |
| `score-over` | `#f87171` | Over-par scores |
| `score-even` | `#9ca3af` | Even par (E) |

These tokens are added to `tailwind.config.js` as custom color extensions, replacing ad-hoc gray/green usage across the codebase.

### Typography Rules

- **Section labels:** `text-xs uppercase tracking-widest font-bold` in `text-muted`
- **Page titles:** `text-xl font-bold tracking-tight` in `text-primary`
- **Team names:** `font-semibold text-primary`
- **Scores:** `font-mono font-bold`
- **Metadata:** `text-xs text-muted`

---

## Components

### New: `BottomNav`
Fixed bottom navigation bar with 5 tabs: Scores, Season, Picks, Setup (Home = Scores tab, no separate Home tab).

- Background: `bg-elevated`, 1px top border in `border` color
- Active tab: icon + label in `score-under` green
- Inactive tab: icon + label in gray-500
- iOS safe area padding on bottom
- Replaces all nav links currently in `Layout.jsx`

### New: `HybridTeamRow`
The core scoreboard row component. Used on both Home and Scoreboard pages.

**Structure:**
```
[rank] [team name ──────────────────] [total score]
       R1: -12  R2: -11  R3: -10  R4: -9
```

- Rank: colored by position (gold #1, silver #2, bronze #3, gray otherwise)
- Leader row: gold left border (`border-l-2 border-accent-gold`)
- Total score: `font-mono font-bold text-score-under` (large, right-aligned)
- Sub-row: round scores in `text-xs text-muted`, indented to align under team name
- Full row tappable to expand/collapse player drawer
- Smooth expand/collapse animation

### New: `PlayerInlineRow`
Single-line player row shown inside the expanded team drawer.

**Structure:**
```
[pos] [player name ──────────────] [thru] [R1] [R2] [R3] [R4] [total]
```

- Background: `bg-elevated` to distinguish from team rows
- CUT/WD/DQ players: 40% opacity, strikethrough name, `—` for missing rounds
- Round scores: small pill badges (`bg-surface text-secondary text-xs`)
- Total: `font-mono font-bold text-score-under`

### Updated: `ScoreTag`
Color tokens updated to new palette. No structural changes.

### Updated: `Layout`
- Top bar slimmed: logo + live status pill only, no nav links
- Bottom nav slot added
- `min-h-screen` replaced with proper flex column layout (top bar + scrollable content + fixed bottom nav)
- `max-w-2xl mx-auto` on content area for desktop

---

## Pages

### Home (Scores Tab) — `/`
- Tournament header: name (large bold), round + status label, live pill if active
- `HybridTeamRow` list for all teams, sorted by total score
- Tap to expand: `PlayerInlineRow` list slides in below team's sub-row
- No pagination — pool is small (typically 6–10 teams)
- Auto-refresh every 10 minutes during tournament window (existing `useAutoRefresh` hook, unchanged)
- If no active tournament: simple card showing next scheduled tournament name + date

### Scoreboard — `/scoreboard`
- Tournament selector dropdown at top (dark styled, defaults to most recent/active)
- Same `HybridTeamRow` + `PlayerInlineRow` structure as Home
- Reuses the same scoreboard data — just adds tournament switching

### Season — `/season`
- Page label + season year
- Dark-themed standings table: `bg-elevated` header, `bg-surface` rows, alternating `border` dividers
- Tournament columns: abbreviated names (fit without horizontal scroll where possible)
- Gold highlight row for season leader
- Rank column fixed on left

### Picks — `/picks`
- Pill-style team selector tabs at top (active: `bg-score-under text-black`, inactive: `bg-surface text-secondary`)
- Full-width search input (`bg-elevated`, green focus ring)
- Player rows: name + current score + checkbox
- `4/6 selected` count badge in `accent-gold` when ≥4 picked
- CUT/WD players: grayed out, unselectable, pushed to bottom

### Setup — `/setup`
- Two sections: Teams + Tournaments
- Team rows with red delete button (confirm before delete)
- Inline add-team input + green "Add" button
- Year dropdown → tournament dropdown (same logic, dark restyled)

### Team Detail — `/teams/:id`
- Inherits new colors automatically via shared components
- No structural changes this pass

---

## Files Changed

| File | Change |
|---|---|
| `client/tailwind.config.js` | Add new color tokens |
| `client/src/index.css` | Update `body` background to `bg-base` |
| `client/src/components/Layout.jsx` | Slim top bar, add bottom nav slot |
| `client/src/components/BottomNav.jsx` | New component |
| `client/src/components/HybridTeamRow.jsx` | New component |
| `client/src/components/PlayerInlineRow.jsx` | New component |
| `client/src/components/ScoreTag.jsx` | Color token update |
| `client/src/pages/Home.jsx` | Rebuild as live leaderboard |
| `client/src/pages/Scoreboard.jsx` | Use HybridTeamRow, add tournament selector |
| `client/src/pages/Season.jsx` | Dark table reskin |
| `client/src/pages/Picks.jsx` | Pill tabs, dark search, player rows |
| `client/src/pages/Setup.jsx` | Dark reskin |

---

## Out of Scope

- Backend changes
- New features (e.g. push notifications, user accounts)
- Team Detail page structural changes
- Performance optimizations
- Any changes to `api/` directory
