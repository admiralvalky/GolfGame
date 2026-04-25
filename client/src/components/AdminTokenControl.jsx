import { useState } from 'react';
import { clearAdminToken, getAdminToken, setAdminToken } from '../api.js';

export default function AdminTokenControl() {
  const [draft, setDraft] = useState(getAdminToken());
  const [hasToken, setHasToken] = useState(Boolean(getAdminToken()));

  function handleSave(e) {
    e.preventDefault();
    setAdminToken(draft);
    setHasToken(Boolean(draft.trim()));
  }

  function handleClear() {
    clearAdminToken();
    setDraft('');
    setHasToken(false);
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-pool-elevated border border-pool-rim rounded-lg p-3 flex flex-wrap items-end gap-2"
    >
      <div className="flex-1 min-w-44">
        <label className="block text-xs text-pool-muted font-medium mb-1">
          Admin token
        </label>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Only needed if configured"
          className="w-full bg-pool-surface border border-pool-rim text-pool-primary placeholder:text-pool-faint rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pool-under"
        />
      </div>
      <button
        type="submit"
        className="bg-pool-under text-black px-3 py-2 rounded text-sm font-medium hover:bg-green-400 transition-colors"
      >
        {hasToken ? 'Update' : 'Save'}
      </button>
      {hasToken && (
        <button
          type="button"
          onClick={handleClear}
          className="text-pool-muted hover:text-pool-primary px-2 py-2 text-sm"
        >
          Clear
        </button>
      )}
    </form>
  );
}
