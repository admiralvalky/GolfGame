import { useState } from 'react';

/**
 * Searchable list of players to pick from.
 * Props:
 *   players: [{id, name, score, status}]
 *   selected: [{player_espn_id, player_name}]
 *   onToggle: (player) => void
 *   max: number (default 6)
 */
export default function PlayerPicker({ players = [], selected = [], onToggle, max = 6 }) {
  const [search, setSearch] = useState('');

  const selectedIds = new Set(selected.map((p) => p.player_espn_id));

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const isFull = selected.length >= max;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-pool-rim rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-pool-under"
        />
        <span className="text-sm text-pool-muted whitespace-nowrap">
          {selected.length}/{max}
        </span>
      </div>

      <div className="overflow-y-auto max-h-[50vh] sm:max-h-96 border border-pool-rim rounded-lg divide-y divide-gray-100 bg-pool-surface">
        {filtered.length === 0 && (
          <p className="text-center text-pool-faint py-6 text-sm">No players found</p>
        )}
        {filtered.map((player) => {
          const isPicked = selectedIds.has(player.id);
          const isCut = ['CUT', 'WD', 'DQ', 'MDF'].includes(
            String(player.score).toUpperCase()
          );

          return (
            <button
              key={player.id}
              onClick={() => onToggle(player)}
              disabled={!isPicked && isFull}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isPicked
                  ? 'bg-pool-surface hover:bg-pool-surface'
                  : isFull
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-pool-elevated active:bg-pool-elevated'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isPicked ? (
                  <span className="w-5 h-5 rounded-full bg-pool-under text-black text-xs flex items-center justify-center font-bold flex-shrink-0">
                    ✓
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-pool-rim flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${isCut ? 'text-pool-faint line-through' : 'text-pool-primary'}`}>
                  {player.name}
                </span>
                {isCut && (
                  <span className="text-xs bg-pool-elevated text-pool-muted px-1.5 py-0.5 rounded">
                    {player.score}
                  </span>
                )}
              </div>
              <span
                className={`font-mono text-sm flex-shrink-0 ml-2 ${
                  isCut
                    ? 'text-pool-faint'
                    : String(player.score).startsWith('-')
                    ? 'text-red-600 font-semibold'
                    : player.score === 'E' || player.score === '0'
                    ? 'text-pool-secondary'
                    : 'text-pool-gold'
                }`}
              >
                {player.score}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
