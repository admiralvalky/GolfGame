const UA = 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)';

/** Default timeout for all ESPN API fetches (ms). */
const FETCH_TIMEOUT_MS = 8000;

/**
 * fetch() wrapper that aborts after `ms` milliseconds.
 * Prevents serverless functions from hanging on slow ESPN responses.
 */
async function fetchWithTimeout(url, options = {}, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function espnFetch(url) {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export function deriveOverallStatus(c, linescores, maxRound) {
  const desc = (c.status?.type?.description ?? '').toUpperCase();
  const name = (c.status?.type?.name ?? '').toUpperCase();
  if (desc.includes('CUT') || name.includes('CUT')) return 'CUT';
  if (desc.includes('WITHDRAW') || desc === 'WD' || name.includes('WD')) return 'WD';
  if (desc === 'DQ' || name.includes('DQ')) return 'DQ';
  if (desc === 'MDF' || name.includes('MDF')) return 'MDF';

  if (linescores.length > 0) {
    // Ignore pre-created empty rounds (same fix as extractThru) — ESPN adds a
    // period N+1 entry with 0 holes for all players before that round starts,
    // including players who were cut and will never play it.
    const roundsWithData = linescores.filter(ls => (ls.linescores ?? []).length > 0);
    if (roundsWithData.length > 0) {
      const playerMaxRound = Math.max(...roundsWithData.map(ls => ls.period));
      const allRoundsComplete = roundsWithData.every(ls => ls.linescores.length >= 18);
      if (allRoundsComplete) {
        if (maxRound >= 3 && playerMaxRound <= 2) return 'CUT';
        if (maxRound >= 4 && playerMaxRound === 3) return 'MDF';
      }
    }
  }

  return String(c.score ?? '').trim().toUpperCase();
}

export function extractThru(c, linescores) {
  if (c.status?.thru != null) return c.status.thru;
  const detail = c.status?.type?.shortDetail ?? '';
  const tMatch = detail.match(/\bT(\d+)\b/);
  if (tMatch) return Number(tMatch[1]);
  const thruMatch = detail.match(/Thru\s+(\d+)/i);
  if (thruMatch) return Number(thruMatch[1]);
  if (/\b(F|Final)\b/i.test(detail)) return 'F';
  if (c.status?.type?.state === 'post') return 'F';

  if (linescores.length === 0) return null;
  // ESPN pre-creates future-round entries (e.g. period 3 before R3 starts) with 0 holes.
  // Skip those and find the most recent round that actually has hole-level data.
  const activeRound = [...linescores]
    .sort((a, b) => b.period - a.period)
    .find(ls => (ls.linescores ?? []).length > 0);
  if (!activeRound) return null;
  const holesPlayed = activeRound.linescores.length;
  if (holesPlayed >= 18) return 'F';
  return holesPlayed;
}

export function normalizeStatus(raw) {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('FINAL') || s === 'POST') return 'post';
  if (s.includes('IN_PROGRESS') || s === 'IN') return 'in';
  return 'upcoming';
}

export async function fetchRoundsFromCoreApi(espnTournamentId, playerIds) {
  const idSet = new Set(playerIds);
  const baseUrl = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${espnTournamentId}/competitions/${espnTournamentId}`;
  const competitorsUrl = `${baseUrl}/competitors?limit=300&lang=en&region=us`;

  const res = await fetchWithTimeout(competitorsUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Core API competitors fetch failed: ${res.status}`);
  const json = await res.json();
  const allCompetitors = (json.items ?? []).filter(c => idSet.size === 0 || idSet.has(c.id));

  const roundsMap = new Map();
  const BATCH = 20;
  for (let i = 0; i < allCompetitors.length; i += BATCH) {
    await Promise.all(
      allCompetitors.slice(i, i + BATCH).map(async (comp) => {
        try {
          const lsRes = await fetchWithTimeout(`${baseUrl}/competitors/${comp.id}/linescores?lang=en&region=us`, {
            headers: { 'User-Agent': UA },
          });
          if (!lsRes.ok) return;
          const lsJson = await lsRes.json();
          const rounds = {};
          for (const ls of lsJson.items ?? []) {
            // Same guard as the scoreboard path: ignore pre-created empty future-round
            // entries that ESPN adds for all players (including cut) with 0 hole data.
            if (ls.period && ls.displayValue != null && (ls.linescores ?? []).length > 0) {
              rounds[ls.period] = ls.displayValue.trim();
            }
          }
          roundsMap.set(comp.id, rounds);
        } catch (_) { /* skip individual player failures */ }
      })
    );
  }
  return roundsMap;
}

// Fetches the full competitor list for a (historical) tournament from the Core API,
// including player names and scores. Used when the Site API scoreboard returns the
// wrong event (it substitutes the currently active tournament for expired event IDs).
export async function fetchCompetitorsFromCoreApi(espnTournamentId) {
  const baseUrl = `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/${espnTournamentId}/competitions/${espnTournamentId}`;

  // One request returns all ~156 competitors with id + order.
  const listRes = await fetchWithTimeout(`${baseUrl}/competitors?limit=300&lang=en&region=us`, { headers: { 'User-Agent': UA } });
  if (!listRes.ok) throw new Error(`Core API competitor list: ${listRes.status}`);
  const items = (await listRes.json()).items ?? [];

  // Batch-fetch athlete names + linescores in parallel per player.
  const rawData = new Map();
  const BATCH = 20;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await Promise.all(batch.map(async (item) => {
      try {
        const [athlete, lsJson] = await Promise.all([
          fetchWithTimeout(`https://sports.core.api.espn.com/v2/sports/golf/athletes/${item.id}?lang=en&region=us`, { headers: { 'User-Agent': UA } })
            .then(r => r.ok ? r.json() : null).catch(() => null),
          fetchWithTimeout(`${baseUrl}/competitors/${item.id}/linescores?lang=en&region=us`, { headers: { 'User-Agent': UA } })
            .then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        const rounds = {};
        for (const ls of lsJson?.items ?? []) {
          if (ls.period && ls.displayValue != null && (ls.linescores ?? []).length > 0) {
            rounds[ls.period] = ls.displayValue.trim();
          }
        }
        rawData.set(String(item.id), {
          order: item.order ?? 999,
          name: athlete?.displayName ?? athlete?.fullName ?? 'Unknown',
          rounds,
        });
      } catch (_) { /* skip individual player failures */ }
    }));
  }

  // Determine max round (for CUT detection).
  let maxRound = 0;
  for (const { rounds } of rawData.values()) {
    const keys = Object.keys(rounds).map(Number).filter(n => !isNaN(n));
    if (keys.length > 0) maxRound = Math.max(maxRound, ...keys);
  }

  // Build competitor list with derived score/status.
  const competitors = [];
  for (const [id, { order, name, rounds }] of rawData) {
    const roundCount = Object.keys(rounds).length;
    const roundNums = Object.values(rounds).map(s => {
      const t = String(s).trim().toUpperCase();
      return t === 'E' ? 0 : parseInt(t, 10);
    }).filter(n => !isNaN(n));
    const totalNum = roundNums.length > 0 ? roundNums.reduce((a, b) => a + b, 0) : null;
    const totalStr = totalNum == null ? 'E' : totalNum === 0 ? 'E' : totalNum > 0 ? `+${totalNum}` : String(totalNum);

    let score;
    if (maxRound >= 3 && roundCount <= 2) score = 'CUT';
    else if (maxRound >= 4 && roundCount === 3) score = 'MDF';
    else score = totalStr;

    competitors.push({ id, name, score, order });
  }
  return competitors;
}

function computeRanks(scoreMap) {
  const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);
  const active = [];
  const cutPlayers = [];
  for (const [id, data] of scoreMap) {
    const s = String(data.totalScore ?? '').toUpperCase();
    const n = s === 'E' ? 0 : parseInt(s, 10);
    if (!CUT_STATUSES.has(data.overallStatus)) {
      if (!isNaN(n)) active.push({ id, score: n });
    } else {
      if (!isNaN(n)) cutPlayers.push({ id, score: n });
    }
  }
  active.sort((a, b) => a.score - b.score);
  for (let i = 0; i < active.length; ) {
    let j = i;
    while (j < active.length && active[j].score === active[i].score) j++;
    const display = j - i > 1 ? `T${i + 1}` : String(i + 1);
    for (let k = i; k < j; k++) scoreMap.get(active[k].id).rank = display;
    i = j;
  }
  const cutStartOffset = active.length;
  cutPlayers.sort((a, b) => a.score - b.score);
  for (let i = 0; i < cutPlayers.length; ) {
    let j = i;
    while (j < cutPlayers.length && cutPlayers[j].score === cutPlayers[i].score) j++;
    const rankNum = cutStartOffset + i + 1;
    const display = j - i > 1 ? `T${rankNum}` : String(rankNum);
    for (let k = i; k < j; k++) scoreMap.get(cutPlayers[k].id).rank = display;
    i = j;
  }
}

async function persistScoreCache(supabase, espnTournamentId, scoreMap) {
  try {
    const now = new Date().toISOString();
    const rows = [...scoreMap]
      .filter(([, data]) => Object.keys(data.rounds ?? {}).length > 0)
      .map(([playerId, data]) => ({
        espn_tournament_id: espnTournamentId,
        player_espn_id: playerId,
        rounds_json: data.rounds,
        thru: data.thru != null ? String(data.thru) : null,
        overall_status: data.overallStatus ?? null,
        total_score: data.totalScore ?? null,
        rank: data.rank ?? null,
        saved_at: now,
      }));
    if (rows.length > 0) {
      await supabase
        .from('cached_player_scores')
        .upsert(rows, { onConflict: 'espn_tournament_id,player_espn_id' });
    }
  } catch (err) {
    console.error('Failed to cache scores to DB:', err.message);
  }
}

function buildScoreMapFromCache(rows) {
  const scoreMap = new Map();
  for (const row of rows) {
    scoreMap.set(row.player_espn_id, {
      rounds: row.rounds_json,
      thru: row.thru,
      overallStatus: row.overall_status ?? '',
      totalScore: row.total_score ?? '',
      rank: row.rank ?? null,
    });
  }
  return scoreMap;
}

/**
 * Fetch all player scores for a tournament.
 *
 * Fallback chain:
 *   1. `cached_player_scores` DB table — for `post` tournaments (ESPN clears linescores after events end)
 *   2. ESPN Site API scoreboard — fast, works for live/recent events
 *   3. DB cache again — if ESPN returned wrong event or empty data
 *   4. ESPN Core API — retains historical data indefinitely; slower but authoritative
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} espnTournamentId
 * @param {'upcoming'|'in'|'post'|''} status - effective tournament status
 * @returns {Promise<{ scoreMap: Map<string, object>, venue: { course: string|null, par: number|null } }>}
 */
export async function fetchPlayerScores(supabase, espnTournamentId, status = '') {
  // Completed tournaments: serve from cache — ESPN clears linescores after events end.
  // skipCache is set to true when the post-tournament cache is found but stale so the
  // second cache lookup in the competitors===0 branch doesn't re-serve the same bad data.
  let skipCache = false;
  let postCachedRows = null;

  if (status === 'post') {
    const { data: cached } = await supabase
      .from('cached_player_scores')
      .select('*')
      .eq('espn_tournament_id', espnTournamentId);
    postCachedRows = cached ?? null;
    if (cached && cached.length > 0) {
      // Validate cache completeness. If no player has R3/R4 data the cache was likely
      // written mid-tournament (or from the wrong event) and needs to be refreshed.
      // Players who made the cut always have R3+ data in a completed tournament.
      const hasLaterRoundData = cached.some(row => {
        const r = row.rounds_json ?? {};
        return r['3'] != null || r['4'] != null;
      });
      if (hasLaterRoundData) {
        console.log(`Serving post-tournament scores from cache for ${espnTournamentId}`);
        return { scoreMap: buildScoreMapFromCache(cached), venue: { course: null, par: null } };
      }
      console.warn(`Post-tournament cache for ${espnTournamentId} has no R3/R4 data — trying ESPN refresh before using cache`);
      skipCache = true; // prevent the fallback path from re-serving this same stale data
    } else {
      console.warn(`No cache for completed tournament ${espnTournamentId}, falling back to ESPN`);
    }
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${espnTournamentId}`;
  let competitors = [];
  let venue = { course: null, par: null };
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const json = await res.json();
      competitors = json.events?.[0]?.competitions?.[0]?.competitors ?? [];
      // Validate that ESPN returned the correct event. The scoreboard endpoint silently
      // substitutes the currently active tournament when given a historical/expired event
      // ID — do not cache or use data from the wrong event.
      const returnedEventId = String(json.events?.[0]?.id ?? '');
      if (returnedEventId && returnedEventId !== String(espnTournamentId)) {
        console.warn(`ESPN scoreboard returned event ${returnedEventId}, not ${espnTournamentId} — ignoring (wrong event substitution)`);
        competitors = [];
      } else {
        const comp = json.events?.[0]?.competitions?.[0];
        venue = {
          course: comp?.venue?.fullName ?? null,
          par: comp?.course?.par ?? comp?.situation?.par ?? null,
        };
      }
    }
  } catch (err) {
    console.error(`ESPN fetch failed for ${espnTournamentId}:`, err.message);
  }

  // If ESPN returned no data (or wrong event), fall back to DB cache then Core API.
  if (competitors.length === 0) {
    if (!skipCache) {
      const { data: rows } = await supabase
        .from('cached_player_scores')
        .select('*')
        .eq('espn_tournament_id', espnTournamentId);

      if (rows && rows.length > 0) {
        console.log(`Using DB-cached scores for ESPN tournament ${espnTournamentId}`);
        return { scoreMap: buildScoreMapFromCache(rows), venue };
      }
    }

    // Last resort: Core API retains historical data indefinitely.
    console.warn(`No scoreboard data for ${espnTournamentId}, attempting Core API fallback`);
    try {
      const coreRounds = await fetchRoundsFromCoreApi(espnTournamentId, []);
      if (coreRounds.size > 0) {
        let coreMaxRound = 0;
        for (const rounds of coreRounds.values()) {
          const keys = Object.keys(rounds).map(Number).filter(n => !isNaN(n));
          if (keys.length > 0) coreMaxRound = Math.max(coreMaxRound, ...keys);
        }
        const scoreMap = new Map();
        for (const [id, rounds] of coreRounds) {
          const roundNums = Object.values(rounds).map(s => {
            const t = String(s).trim().toUpperCase();
            return t === 'E' ? 0 : parseInt(t, 10);
          }).filter(n => !isNaN(n));
          const totalNum = roundNums.length > 0 ? roundNums.reduce((a, b) => a + b, 0) : null;
          const totalScore = totalNum == null ? '' : totalNum === 0 ? 'E' : totalNum > 0 ? `+${totalNum}` : String(totalNum);
          const playerRoundCount = Object.keys(rounds).length;
          let overallStatus;
          if (coreMaxRound >= 3 && playerRoundCount <= 2) overallStatus = 'CUT';
          else if (coreMaxRound >= 4 && playerRoundCount === 3) overallStatus = 'MDF';
          else overallStatus = totalScore || 'E';
          scoreMap.set(id, { rounds, thru: 'F', overallStatus, totalScore });
        }
        computeRanks(scoreMap);
        await persistScoreCache(supabase, espnTournamentId, scoreMap);
        return { scoreMap, venue };
      }
    } catch (coreErr) {
      console.error(`Core API fallback failed for ${espnTournamentId}:`, coreErr.message);
    }

    if (postCachedRows && postCachedRows.length > 0) {
      console.warn(`Using existing post-tournament cache for ${espnTournamentId} after ESPN/Core fallback failed`);
      return { scoreMap: buildScoreMapFromCache(postCachedRows), venue };
    }

    throw new Error(`No score data available for ESPN tournament ${espnTournamentId}`);
  }

  // First pass: determine max round — only count rounds with actual hole data
  // to avoid pre-created empty future-round entries inflating the count.
  let maxRound = 0;
  for (const c of competitors) {
    for (const ls of c.linescores ?? []) {
      if (ls.period > maxRound && (ls.linescores ?? []).length > 0) maxRound = ls.period;
    }
  }

  // Second pass: build scoreMap
  const scoreMap = new Map();
  for (const c of competitors) {
    const linescores = c.linescores ?? [];
    const rounds = {};
    for (const ls of linescores) {
      // Only store a round total if the period has actual hole data.
      // ESPN sets displayValue="-" on pre-created empty future-round entries,
      // which would make hasScore=true and suppress the CUT label in the UI.
      if (ls.period && ls.displayValue != null && ls.displayValue.trim() !== '' && (ls.linescores ?? []).length > 0) {
        rounds[ls.period] = ls.displayValue.trim();
      }
    }
    scoreMap.set(c.id, {
      rounds,
      thru: extractThru(c, linescores),
      overallStatus: deriveOverallStatus(c, linescores, maxRound),
      totalScore: String(c.score ?? '').trim(),
    });
  }

  // If no round data, fall back to core API
  const hasRoundData = [...scoreMap.values()].some(d => Object.keys(d.rounds).length > 0);
  if (!hasRoundData) {
    console.log(`Scoreboard API has no round data for ${espnTournamentId} — fetching from core API`);
    try {
      const coreRounds = await fetchRoundsFromCoreApi(espnTournamentId, [...scoreMap.keys()]);
      for (const [id, rounds] of coreRounds) {
        if (!scoreMap.has(id)) continue;
        const entry = scoreMap.get(id);
        entry.rounds = rounds;

        const roundNums = Object.values(rounds).map(s => {
          const t = String(s).trim().toUpperCase();
          if (t === 'E') return 0;
          const n = parseInt(t, 10);
          return isNaN(n) ? null : n;
        }).filter(n => n !== null);
        if (roundNums.length > 0) {
          const tot = roundNums.reduce((a, b) => a + b, 0);
          entry.totalScore = tot === 0 ? 'E' : tot > 0 ? `+${tot}` : String(tot);
        }

        if (Object.keys(rounds).length > 0) entry.thru = 'F';
      }
    } catch (err) {
      console.error(`Core API fallback failed for ${espnTournamentId}:`, err.message);
    }
  }

  // Third pass: compute display ranks
  computeRanks(scoreMap);

  // Persist to Supabase — only rows with actual round data so we never
  // overwrite good historical scores with empty ESPN responses.
  await persistScoreCache(supabase, espnTournamentId, scoreMap);

  return { scoreMap, venue };
}
