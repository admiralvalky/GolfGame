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
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-golf-green"
        />
        <span className="text-sm text-gray-500 ml-3 whitespace-nowrap">
          {selected.length}/{max} picked
        </span>
      </div>

      <div className="overflow-y-auto max-h-80 border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-6 text-sm">No players found</p>
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
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                isPicked
                  ? 'bg-golf-green/10 hover:bg-golf-green/20'
                  : isFull
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {isPicked ? (
                  <span className="w-5 h-5 rounded-full bg-golf-green text-white text-xs flex items-center justify-center font-bold">
                    ✓
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-gray-300" />
                )}
                <span className={`text-sm font-medium ${isCut ? 'text-gray-400 line-through' : ''}`}>
                  {player.name}
                </span>
                {isCut && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {player.score}
                  </span>
                )}
              </div>
              <span
                className={`font-mono text-sm ${
                  isCut
                    ? 'text-gray-400'
                    : String(player.score).startsWith('-')
                    ? 'text-red-600 font-semibold'
                    : player.score === 'E' || player.score === '0'
                    ? 'text-gray-600'
                    : 'text-blue-600'
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
