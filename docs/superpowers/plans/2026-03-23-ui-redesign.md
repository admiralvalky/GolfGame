# Golf Pool UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Golf Pool app to a Golf Heritage dark theme with bottom tab navigation, hybrid scoreboard rows, and the Home page as the live leaderboard.

**Architecture:** All changes confined to `client/src/` and `client/tailwind.config.js`. Three new components (BottomNav, HybridTeamRow, PlayerInlineRow) are created. Existing components and pages receive token and class updates. No backend, API, or server changes.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router DOM 6

**Spec:** `docs/superpowers/specs/2026-03-23-ui-redesign-design.md`

**Token naming note:** The spec uses abstract names (`bg-base`, `text-primary`, `border-subtle`). This plan uses a `pool.*` namespace in Tailwind (`bg-pool-base`, `text-pool-primary`, `border-pool-rim`) to avoid conflicts with Tailwind built-ins. The plan is self-consistent — always follow the `pool.*` names in this document.

**Dev command:** `cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame && npm run dev` — starts Express (port 3001) + Vite (port 5173). Visit http://localhost:5173.

---

## File Map

| File | Change |
|------|--------|
| `client/tailwind.config.js` | Replace `golf.*` tokens with `pool.*` dark-theme palette |
| `client/src/index.css` | `body` background → `bg-pool-base` |
| `client/src/App.jsx` | Add `/scoreboard` → `/` redirect; add `/picks` → `/picks/:id` redirect component |
| `client/src/components/Layout.jsx` | Slim top bar + bottom nav slot; remove old header nav and footer |
| `client/src/components/BottomNav.jsx` | **NEW** — 4-tab fixed bottom navigation |
| `client/src/components/ScoreTag.jsx` | Swap light-theme classes for `pool.*` tokens |
| `client/src/components/LastUpdated.jsx` | Swap `golf-green`, `golf-dark`, `gray-*` for `pool.*` tokens |
| `client/src/components/ErrorBoundary.jsx` | Replace all hardcoded inline styles with dark equivalents |
| `client/src/components/PlayerPicker.jsx` | Full dark-theme class swap |
| `client/src/components/HybridTeamRow.jsx` | **NEW** — team row: rank + total + round sub-row + expandable player drawer |
| `client/src/components/PlayerInlineRow.jsx` | **NEW** — single-line player row with counting-round badge highlight |
| `client/src/pages/Home.jsx` | **REBUILD** — tournament dropdown + HybridTeamRow leaderboard |
| `client/src/pages/Scoreboard.jsx` | Replace entire file with `<Navigate to="/" replace />` |
| `client/src/pages/Season.jsx` | Dark table reskin |
| `client/src/pages/Picks.jsx` | Dark reskin throughout |
| `client/src/pages/Setup.jsx` | Dark reskin throughout |
| `client/src/pages/TeamDetail.jsx` | Dark reskin throughout |

---

## Task 1: Design Tokens

**Files:**
- Modify: `client/tailwind.config.js`
- Modify: `client/src/index.css`

- [ ] **Step 1: Replace tailwind.config.js color tokens**

Replace the entire `colors` block in `client/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pool: {
          base:          '#0d1f15',
          surface:       '#1a3a2a',
          elevated:      '#0f2318',
          rim:           '#2d5a3d',
          primary:       '#f0fdf4',
          secondary:     '#86efac',
          muted:         '#6ee7b7',
          faint:         '#4b7a5e',
          gold:          '#d4af37',
          under:         '#4ade80',
          over:          '#f87171',
          even:          '#9ca3af',
          counting:      '#166534',
          'counting-fg': '#bbf7d0',
          'err-bg':      '#2d1515',
          'err-fg':      '#fca5a5',
        },
      },
    },
  },
  plugins: [],
};
```

This gives Tailwind classes like `bg-pool-base`, `text-pool-primary`, `border-pool-rim`, etc.

- [ ] **Step 2: Update body background in index.css**

Replace `client/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-pool-base text-pool-primary min-h-screen;
  }
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame && npm run dev
```

Visit http://localhost:5173. The page background should be very dark green (`#0d1f15`). Existing text will look broken (white on dark) — that's expected. This confirms tokens are loading.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/tailwind.config.js client/src/index.css
git commit -m "feat: add Golf Heritage dark color tokens"
```

---

## Task 2: Layout + BottomNav

**Files:**
- Create: `client/src/components/BottomNav.jsx`
- Modify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Create BottomNav component**

Create `client/src/components/BottomNav.jsx`:

```jsx
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/',       icon: '🏆', label: 'Scores'  },
  { to: '/season', icon: '📊', label: 'Season'  },
  { to: '/picks',  icon: '⛳', label: 'Picks'   },
  { to: '/setup',  icon: '⚙️', label: 'Setup'   },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-pool-elevated border-t border-pool-rim z-50">
      <div className="max-w-2xl mx-auto flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ to, icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active
                  ? 'text-pool-under'
                  : 'text-gray-500 hover:text-pool-muted'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Rebuild Layout.jsx**

Replace `client/src/components/Layout.jsx` entirely:

```jsx
import BottomNav from './BottomNav.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-pool-base">
      {/* Slim top bar */}
      <header className="fixed top-0 left-0 right-0 bg-pool-elevated border-b border-pool-rim z-40">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center">
          <span className="text-sm font-bold tracking-wide text-pool-primary">⛳ GOLF POOL</span>
        </div>
      </header>

      {/* Scrollable content — padded for fixed header (48px) and fixed bottom nav (~64px) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3 pt-16 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

With dev server running, visit http://localhost:5173. You should see:
- Dark green background
- Slim "⛳ GOLF POOL" header fixed at top
- Bottom tab bar with 4 tabs (Scores, Season, Picks, Setup) fixed at bottom
- Active tab highlighted in green
- Content area scrolls between the two fixed bars

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/components/BottomNav.jsx client/src/components/Layout.jsx
git commit -m "feat: add bottom nav, rebuild Layout with slim top bar"
```

---

## Task 3: Small Component Token Updates (ScoreTag, LastUpdated, ErrorBoundary)

**Files:**
- Modify: `client/src/components/ScoreTag.jsx`
- Modify: `client/src/components/LastUpdated.jsx`
- Modify: `client/src/components/ErrorBoundary.jsx`

- [ ] **Step 1: Update ScoreTag.jsx**

Replace `client/src/components/ScoreTag.jsx`:

```jsx
const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);

export default function ScoreTag({ score, raw }) {
  if (raw && CUT_STATUSES.has(String(raw).toUpperCase())) {
    return (
      <span className="text-pool-faint text-sm line-through font-mono">{raw}</span>
    );
  }

  const n = typeof score === 'number' ? score : parseInt(score, 10);
  if (isNaN(n)) {
    return <span className="text-pool-faint text-sm font-mono">{raw ?? 'N/A'}</span>;
  }

  if (n < 0) {
    return (
      <span className="bg-green-900/50 text-pool-under border border-green-800 px-1.5 py-0.5 rounded font-semibold font-mono text-sm">
        {String(n)}
      </span>
    );
  }

  if (n > 0) {
    return (
      <span className="bg-red-900/40 text-pool-over border border-red-900 px-1.5 py-0.5 rounded font-mono text-sm">
        +{n}
      </span>
    );
  }

  return (
    <span className="bg-pool-elevated text-pool-even border border-pool-rim px-1.5 py-0.5 rounded font-mono text-sm">
      E
    </span>
  );
}
```

- [ ] **Step 2: Update LastUpdated.jsx**

Replace `client/src/components/LastUpdated.jsx`:

```jsx
import { useState } from 'react';

export default function LastUpdated({ timestamp, onRefresh, loading }) {
  const [cooldownActive, setCooldownActive] = useState(false);
  const [showToast, setShowToast] = useState(false);

  if (!timestamp) return null;

  const formatted = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  async function handleRefresh() {
    setCooldownActive(true);
    setTimeout(() => setCooldownActive(false), 5000);
    await onRefresh();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 text-xs text-pool-muted">
      <span>Updated {formatted}</span>
      <button
        onClick={handleRefresh}
        disabled={loading || cooldownActive}
        className="text-pool-secondary hover:text-pool-primary disabled:opacity-40 underline"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      {showToast ? (
        <span className="text-pool-under font-medium">Scores refreshed</span>
      ) : (
        <span className="text-pool-faint">(auto every 10 min)</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update ErrorBoundary.jsx**

Replace the `render()` method's error UI in `client/src/components/ErrorBoundary.jsx`. The class component structure stays the same; only the inline styles change:

```jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('React Error Boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          background: '#2d1515',
          border: '1px solid #7f1d1d',
          borderRadius: '12px',
        }}>
          <h2 style={{ color: '#fca5a5', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{
            background: '#0d1f15',
            border: '1px solid #2d5a3d',
            borderRadius: '8px',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            color: '#86efac',
          }}>
            {this.state.error?.message ?? 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#1a3a2a',
              color: '#f0fdf4',
              border: '1px solid #2d5a3d',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/components/ScoreTag.jsx client/src/components/LastUpdated.jsx client/src/components/ErrorBoundary.jsx
git commit -m "feat: update ScoreTag, LastUpdated, ErrorBoundary to dark theme"
```

---

## Task 4: PlayerPicker Dark Reskin

**Files:**
- Modify: `client/src/components/PlayerPicker.jsx`

Read the full current file before editing. Then make these targeted class replacements throughout:

| Old class | New class |
|-----------|-----------|
| `border-gray-300` | `border-pool-rim` |
| `border-gray-200` | `border-pool-rim` |
| `bg-gray-50` | `bg-pool-elevated` |
| `bg-gray-100` | `bg-pool-elevated` |
| `hover:bg-gray-50` | `hover:bg-pool-elevated` |
| `hover:bg-gray-100` | `hover:bg-pool-elevated` |
| `bg-golf-green/10` | `bg-pool-surface` |
| `bg-golf-green` | `bg-pool-under` |
| `hover:bg-golf-dark` | `hover:bg-pool-elevated` |
| `text-gray-900` | `text-pool-primary` |
| `text-gray-700` | `text-pool-primary` |
| `text-gray-600` | `text-pool-secondary` |
| `text-gray-500` | `text-pool-muted` |
| `text-gray-400` | `text-pool-faint` |
| `text-gray-300` | `text-pool-faint` |
| `text-blue-600` | `text-pool-gold` |
| `text-white` (on green bg) | `text-black` |
| `ring-golf-green` | `ring-pool-under` |
| `focus:ring-golf-green` | `focus:ring-pool-under` |
| `bg-white` | `bg-pool-surface` |

- [ ] **Step 1: Read the current file**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/components/PlayerPicker.jsx
```

- [ ] **Step 2: Apply class replacements**

Make all replacements from the table above. Use Edit tool for each distinct block. Key areas:
- Container div (background, border)
- Search input (background, border, focus ring, text color)
- Player rows (hover state, text colors)
- Selected state (bg-golf-green → bg-pool-under, text color)
- CUT/WD player styling (opacity, strikethrough text color)
- Selection counter badge (text-blue-600 → text-pool-gold)

- [ ] **Step 3: Verify**

Visit http://localhost:5173/picks/1 (or any valid tournament ID). The player picker should have dark background, dark search input, green selection highlight.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/components/PlayerPicker.jsx
git commit -m "feat: PlayerPicker dark theme reskin"
```

---

## Task 5: HybridTeamRow Component

**Files:**
- Create: `client/src/components/HybridTeamRow.jsx`

This is the core new component. It renders a team row with:
1. Top line: rank badge + team name + total score
2. Sub-row: R1/R2/R3/R4 round scores (always visible)
3. An expandable drawer slot (children prop) for player rows

- [ ] **Step 1: Create HybridTeamRow.jsx**

Create `client/src/components/HybridTeamRow.jsx`:

```jsx
const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'W/D']);

function scoreColor(val) {
  if (val === null || val === undefined) return 'text-pool-faint';
  if (val < 0) return 'text-pool-under';
  if (val > 0) return 'text-pool-over';
  return 'text-pool-even';
}

function scoreDisplay(val) {
  if (val === null || val === undefined) return '—';
  if (val === 0) return 'E';
  return val > 0 ? `+${val}` : String(val);
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-pool-gold font-bold text-lg w-7 text-center flex-shrink-0">{rank}</span>;
  if (rank === 2) return <span className="text-gray-300 font-bold text-lg w-7 text-center flex-shrink-0">{rank}</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold text-lg w-7 text-center flex-shrink-0">{rank}</span>;
  return <span className="text-gray-500 font-bold text-base w-7 text-center flex-shrink-0">{rank}</span>;
}

export default function HybridTeamRow({ team, isExpanded, onToggle, children }) {
  const { rank, team_name, rounds = {}, total } = team;
  const isLeader = rank === 1;

  return (
    <div className={`border-b border-pool-rim ${isLeader ? 'border-l-2 border-l-pool-gold' : ''}`}>
      {/* Main row — tappable */}
      <button
        onClick={onToggle}
        className="w-full text-left bg-pool-surface hover:bg-pool-elevated transition-colors px-3 py-3"
      >
        {/* Top line: rank + name + total */}
        <div className="flex items-center gap-2">
          <RankBadge rank={rank} />
          <span className="flex-1 font-semibold text-pool-primary text-sm truncate">{team_name}</span>
          <span className={`font-mono font-bold text-xl ${scoreColor(total)}`}>
            {scoreDisplay(total)}
          </span>
          <span className="text-pool-faint text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
        </div>

        {/* Sub-row: round scores */}
        <div className="flex gap-3 mt-1 ml-9">
          {[1, 2, 3, 4].map((r) => {
            const val = rounds[r];
            return (
              <span key={r} className="text-xs text-pool-muted">
                R{r}:{' '}
                <span className={`font-mono ${scoreColor(val)}`}>
                  {scoreDisplay(val)}
                </span>
              </span>
            );
          })}
        </div>
      </button>

      {/* Expandable drawer */}
      {isExpanded && (
        <div className="bg-pool-elevated border-t border-pool-rim">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/components/HybridTeamRow.jsx
git commit -m "feat: create HybridTeamRow component"
```

---

## Task 6: PlayerInlineRow Component

**Files:**
- Create: `client/src/components/PlayerInlineRow.jsx`

Renders a single player on one line inside the expanded team drawer. Counting rounds get a highlighted badge.

- [ ] **Step 1: Create PlayerInlineRow.jsx**

Create `client/src/components/PlayerInlineRow.jsx`:

```jsx
const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'W/D']);

function scoreColor(val) {
  if (val === null || val === undefined) return 'text-pool-faint';
  const s = String(val).trim().toUpperCase();
  const n = s === 'E' ? 0 : parseInt(s, 10);
  if (isNaN(n)) return 'text-pool-faint';
  if (n < 0) return 'text-pool-under';
  if (n > 0) return 'text-pool-over';
  return 'text-pool-even';
}

export default function PlayerInlineRow({ player }) {
  const { name, position, thru, rounds = {}, counting_rounds = [], status, eligible_rounds = [] } = player;
  const isCut = CUT_STATUSES.has(String(status ?? '').toUpperCase());
  const hasNoData = eligible_rounds.length === 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-pool-rim last:border-b-0 ${
      hasNoData ? 'opacity-40' : ''
    }`}>
      {/* Position */}
      <span className="text-xs text-pool-muted w-8 flex-shrink-0 font-mono">
        {isCut ? <span className="text-pool-faint">CUT</span> : (position ?? '—')}
      </span>

      {/* Player name */}
      <span className={`text-sm flex-1 truncate ${
        isCut ? 'line-through text-pool-muted' : 'font-medium text-pool-primary'
      }`}>
        {name}
      </span>

      {/* Thru */}
      <span className="text-xs text-pool-muted w-6 text-center flex-shrink-0">
        {thru ?? '—'}
      </span>

      {/* Round scores */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((r) => {
          const raw = rounds[r];
          const isCounting = counting_rounds.includes(r);
          const display = raw != null ? String(raw) : '—';

          if (isCut && raw == null) {
            return (
              <span key={r} className="text-xs font-mono text-pool-faint w-8 text-center">—</span>
            );
          }

          return (
            <span
              key={r}
              className={`text-xs font-mono px-1 py-0.5 rounded w-8 text-center ${
                isCounting
                  ? 'bg-pool-counting text-pool-counting-fg font-bold'
                  : `bg-pool-surface ${scoreColor(raw)}`
              }`}
            >
              {display}
            </span>
          );
        })}
      </div>

      {/* Player total */}
      <span className={`text-sm font-mono font-bold w-8 text-right flex-shrink-0 ${scoreColor(
        (() => {
          let sum = null;
          for (let r = 1; r <= 4; r++) {
            const raw = rounds[r];
            if (raw == null) continue;
            const s = String(raw).trim().toUpperCase();
            const n = s === 'E' ? 0 : parseInt(s, 10);
            if (!isNaN(n)) { sum = (sum ?? 0) + n; }
          }
          return sum;
        })()
      )}`}>
        {(() => {
          let sum = null;
          for (let r = 1; r <= 4; r++) {
            const raw = rounds[r];
            if (raw == null) continue;
            const s = String(raw).trim().toUpperCase();
            const n = s === 'E' ? 0 : parseInt(s, 10);
            if (!isNaN(n)) { sum = (sum ?? 0) + n; }
          }
          if (sum === null) return '—';
          if (sum === 0) return 'E';
          return sum > 0 ? `+${sum}` : String(sum);
        })()}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/components/PlayerInlineRow.jsx
git commit -m "feat: create PlayerInlineRow component"
```

---

## Task 7: Rebuild Home Page

**Files:**
- Modify: `client/src/pages/Home.jsx`

This is the biggest change. Home becomes the live leaderboard: tournament dropdown at top, HybridTeamRow list below, auto-refresh when live.

- [ ] **Step 1: Read the current Home.jsx in full**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/pages/Home.jsx
```

- [ ] **Step 2: Replace Home.jsx entirely**

Replace `client/src/pages/Home.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { getTournaments, getScoreboard } from '../api.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import HybridTeamRow from '../components/HybridTeamRow.jsx';
import PlayerInlineRow from '../components/PlayerInlineRow.jsx';
import LastUpdated from '../components/LastUpdated.jsx';
import { statusLabel } from '../utils/tournament.js';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Load tournament list once on mount
  useEffect(() => {
    getTournaments()
      .then(({ tournaments: list }) => {
        setTournaments(list);
        // Default: active tournament first, else most recent
        const active = list.find((t) => t.status === 'active');
        const defaultId = active?.id ?? list[0]?.id ?? null;
        setSelectedId(defaultId);
      })
      .catch(() => setError('Failed to load tournaments.'));
  }, []);

  // Load scoreboard when selectedId changes
  const fetchScoreboard = useCallback(async () => {
    if (!selectedId) return;
    setError('');
    try {
      const data = await getScoreboard(selectedId);
      setScoreboard(data);
      setLastUpdated(new Date());
    } catch {
      setError('Failed to load scoreboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    fetchScoreboard();
  }, [fetchScoreboard]);

  // Auto-refresh only when viewing the active tournament
  const activeTournament = tournaments.find((t) => t.id === selectedId);
  const isLive = activeTournament?.status === 'active';
  useAutoRefresh(fetchScoreboard, isLive ? 10 * 60 * 1000 : null);

  function handleToggleTeam(teamId) {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  }

  const selectedTournament = tournaments.find((t) => t.id === selectedId);

  return (
    <div>
      {/* Tournament selector */}
      {tournaments.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedId ?? ''}
            onChange={(e) => {
              setSelectedId(Number(e.target.value));
              setExpandedTeamId(null);
            }}
            className="w-full bg-pool-elevated border border-pool-rim text-pool-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.status === 'active' ? '● LIVE' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tournament header */}
      {selectedTournament && (
        <div className="mb-4">
          <h1 className="text-xl font-bold text-pool-primary">{selectedTournament.name}</h1>
          <p className="text-xs text-pool-muted uppercase tracking-widest mt-0.5">
            {statusLabel(selectedTournament.status)}
            {isLive && (
              <span className="ml-2 bg-green-800 text-green-300 px-2 py-0.5 rounded-full text-[10px] font-bold not-uppercase tracking-normal">
                ● LIVE
              </span>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-pool-err-bg border border-red-900 rounded-xl p-4 text-pool-err-fg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !scoreboard && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-pool-surface animate-pulse rounded h-16" />
          ))}
        </div>
      )}

      {/* No tournaments */}
      {!loading && tournaments.length === 0 && (
        <div className="text-center py-12 text-pool-faint text-sm">
          No tournaments set up yet. Visit Setup to add one.
        </div>
      )}

      {/* Leaderboard */}
      {scoreboard && (
        <div className="rounded-xl overflow-hidden border border-pool-rim">
          {scoreboard.teams?.map((team) => (
            <HybridTeamRow
              key={team.team_id ?? team.team_name}
              team={team}
              isExpanded={expandedTeamId === (team.team_id ?? team.team_name)}
              onToggle={() => handleToggleTeam(team.team_id ?? team.team_name)}
            >
              {team.players?.map((player, i) => (
                <PlayerInlineRow key={player.name ?? i} player={player} />
              ))}
            </HybridTeamRow>
          ))}
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <div className="mt-4">
          <LastUpdated timestamp={lastUpdated} onRefresh={fetchScoreboard} loading={loading} />
        </div>
      )}
    </div>
  );
}
```

**Note on API response shape:** The scoreboard API returns `{ teams: [...] }`. Each team has `team_id`, `team_name`, `rounds` (object keyed 1-4), `total`, and `players` array. If any field names differ from the above, adjust to match what `getScoreboard()` actually returns. You can check the shape by running `curl http://localhost:3001/api/scoreboard?tournamentId=1` in the terminal.

- [ ] **Step 3: Verify**

Visit http://localhost:5173. You should see:
- Tournament dropdown at top
- Tournament name as heading
- LIVE badge if tournament is active
- Team rows in hybrid format (rank + name + total on top line, round scores below)
- Tapping a team expands/collapses the player drawer
- Player rows show position, name, thru, 4 round badges (counting rounds in dark green), total

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/Home.jsx
git commit -m "feat: rebuild Home as live leaderboard with tournament dropdown"
```

---

## Task 8: Scoreboard Page → Redirect

**Files:**
- Modify: `client/src/pages/Scoreboard.jsx`

- [ ] **Step 1: Replace Scoreboard.jsx with redirect**

Replace the entire contents of `client/src/pages/Scoreboard.jsx`:

```jsx
import { Navigate } from 'react-router-dom';

export default function Scoreboard() {
  return <Navigate to="/" replace />;
}
```

- [ ] **Step 2: Verify**

Visit http://localhost:5173/scoreboard — it should immediately redirect to `/` (the home/leaderboard page).

- [ ] **Step 3: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/Scoreboard.jsx
git commit -m "feat: redirect /scoreboard to / (merged into Home)"
```

---

## Task 9: Season Page Dark Reskin

**Files:**
- Modify: `client/src/pages/Season.jsx`

- [ ] **Step 1: Read the current Season.jsx**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/pages/Season.jsx
```

- [ ] **Step 2: Apply dark reskin**

Make these targeted replacements throughout Season.jsx:

| Old | New |
|-----|-----|
| `bg-white` | `bg-pool-surface` |
| `bg-gray-50` | `bg-pool-base` |
| `bg-gray-100` | `bg-pool-elevated` |
| `border-gray-100` | `border-pool-rim` |
| `border-gray-200` | `border-pool-rim` |
| `border-gray-300` | `border-pool-rim` |
| `text-gray-900` | `text-pool-primary` |
| `text-gray-700` | `text-pool-primary` |
| `text-gray-600` | `text-pool-secondary` |
| `text-gray-500` | `text-pool-muted` |
| `text-gray-400` | `text-pool-faint` |
| `text-gray-300` | `text-pool-faint` |
| `bg-golf-dark` | `bg-pool-elevated` |
| `text-golf-*` | `text-pool-secondary` |
| `bg-amber-50` | `bg-pool-elevated` |
| `text-amber-700` | `text-pool-gold` |
| `shadow-sm` | (remove or keep — shadows invisible on dark) |
| `bg-green-*` | `bg-pool-surface` |
| `text-green-*` | `text-pool-under` |
| `text-red-*` | `text-pool-over` |

Additionally, for the season leader row, add `border-l-2 border-pool-gold` to the first-place row.

For empty state text, replace `text-gray-400` or similar with `text-pool-faint`.

- [ ] **Step 3: Verify**

Visit http://localhost:5173/season. The standings table should render with dark background, light text, and consistent border colors.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/Season.jsx
git commit -m "feat: Season page dark reskin"
```

---

## Task 10: Picks Page Dark Reskin + Route Redirect

**Files:**
- Modify: `client/src/pages/Picks.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Read the current Picks.jsx in full**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/pages/Picks.jsx
```

- [ ] **Step 2: Apply dark reskin to Picks.jsx**

Apply the same class replacement table from Task 9 throughout Picks.jsx. Key areas:

- Page background and container
- Team selector tabs: replace active state with `bg-pool-under text-black font-semibold`, inactive with `bg-pool-surface text-pool-secondary border border-pool-rim`
- Save button: `bg-pool-under text-black font-bold` when active, `opacity-50` when disabled
- Error/success messages: use `text-pool-err-fg` / `text-pool-under`
- Loading state: `text-pool-muted`

- [ ] **Step 3: Add `/picks` redirect component to App.jsx**

Read `client/src/App.jsx`, then add a `PicksRedirect` component and route. The component fetches tournaments, finds the active/latest one, and redirects:

```jsx
// Add this import at top of App.jsx
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getTournaments } from './api.js';

// Add this component above the App function in App.jsx
function PicksRedirect() {
  const [targetId, setTargetId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTournaments()
      .then(({ tournaments }) => {
        const active = tournaments.find((t) => t.status === 'active');
        const id = active?.id ?? tournaments[0]?.id ?? null;
        setTargetId(id);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!targetId) return <Navigate to="/setup" replace />;
  return <Navigate to={`/picks/${targetId}`} replace />;
}
```

Then add the route in the Routes block:

```jsx
<Route path="/picks" element={<PicksRedirect />} />
<Route path="/picks/:tournamentId" element={<Picks />} />
```

- [ ] **Step 4: Verify**

- Visit http://localhost:5173/picks — it should redirect to `/picks/:id` for the active/latest tournament
- Picks page should display with dark theme

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/Picks.jsx client/src/App.jsx
git commit -m "feat: Picks dark reskin + /picks redirect to active tournament"
```

---

## Task 11: Setup Page Dark Reskin

**Files:**
- Modify: `client/src/pages/Setup.jsx`

- [ ] **Step 1: Read the current Setup.jsx**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/pages/Setup.jsx
```

- [ ] **Step 2: Apply dark reskin**

Apply the same replacement table from Task 9. Key areas:

- Section containers: `bg-white` → `bg-pool-surface`, `border-gray-100` → `border-pool-rim`
- Inputs and selects: `bg-white` → `bg-pool-elevated`, `border-gray-300` → `border-pool-rim`, `text-gray-900` → `text-pool-primary`
- Focus rings: `ring-golf-green` → `ring-pool-under`
- Primary buttons (Save, Add): `bg-golf-green` → `bg-pool-under text-black`, `hover:bg-golf-dark` → `hover:bg-green-400`
- Delete button: keep red styling but use `text-red-400 hover:text-red-300`
- Success/error messages: `text-green-*` → `text-pool-under`, `text-red-*` → `text-pool-over`
- Section dividers: `border-gray-200` → `border-pool-rim`

- [ ] **Step 3: Verify**

Visit http://localhost:5173/setup. Both sections (Teams + Tournament) should render with dark backgrounds, light text, and functional form controls.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/Setup.jsx
git commit -m "feat: Setup page dark reskin"
```

---

## Task 12: TeamDetail Page Dark Reskin

**Files:**
- Modify: `client/src/pages/TeamDetail.jsx`

- [ ] **Step 1: Read the current TeamDetail.jsx in full**

```bash
cat /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client/src/pages/TeamDetail.jsx
```

- [ ] **Step 2: Apply dark reskin**

Apply the standard replacement table from Task 9. Additional specific items:

- Team header card: `bg-white` → `bg-pool-surface`, border → `border-pool-rim`
- Round cards (R1-R4): `bg-white` → `bg-pool-elevated`, `bg-gray-50` → `bg-pool-surface`
- Player table header: `bg-golf-dark` → `bg-pool-elevated`, `text-white` → `text-pool-primary`
- Player table rows: `bg-white` → `bg-pool-surface`, hover → `hover:bg-pool-elevated`
- `bg-emerald-700` (counting round cells): replace with `bg-pool-counting text-pool-counting-fg`
- Score values: use `text-pool-under` for negative, `text-pool-over` for positive, `text-pool-even` for even
- CUT player rows: `opacity-40` stays, text → `text-pool-muted`
- Error/loading states: standard pattern

- [ ] **Step 3: Verify**

Click on a team name from the Home page (if linked), or visit http://localhost:5173/team/1. The team detail page should display with consistent dark styling.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git add client/src/pages/TeamDetail.jsx
git commit -m "feat: TeamDetail page dark reskin"
```

---

## Task 13: Final Check + Push

- [ ] **Step 1: Full walkthrough**

With `npm run dev` running, manually walk through every page:

1. **Home (/)** — tournament dropdown, leaderboard rows, expand/collapse a team, check player rows
2. **/season** — standings table renders with dark styling
3. **/picks** — redirects to /picks/:id, picks page loads with dark theme
4. **/setup** — both sections visible, form controls functional
5. **/scoreboard** — redirects to /
6. **/team/1** (or any team ID) — team detail loads with dark styling
7. **Tap through all 4 bottom nav tabs** — all routes work, active tab highlights correctly

- [ ] **Step 2: Check mobile view**

In Chrome DevTools, toggle device emulation (iPhone 12 Pro size). Verify:
- No horizontal scrolling on any page
- Bottom nav is thumb-reachable and doesn't overlap content
- Hybrid team rows are readable at mobile size
- Player drawer inline rows don't overflow

- [ ] **Step 3: Build check**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame/client && npm run build
```

Expected: build succeeds with no errors. Warnings are OK.

- [ ] **Step 4: Push to GitHub**

```bash
cd /Users/matthewmyers/Desktop/ClaudeCode/GolfGame
git push origin master
```

Vercel will auto-deploy from the push.

- [ ] **Step 5: Verify on Vercel**

Once deployed, open the Vercel production URL on your phone. Verify the dark theme, bottom nav, and leaderboard all look correct on a real mobile device.
