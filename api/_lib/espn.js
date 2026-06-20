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

export function deriveOverallStatus(c, linescores, fieldMaxScheduled) {
  const desc = (c.status?.type?.description ?? '').toUpperCase();
  const name = (c.status?.type?.name ?? '').toUpperCase();
  if (desc.includes('CUT') || name.includes('CUT')) return 'CUT';
  if (desc.includes('WITHDRAW') || desc === 'WD' || name.includes('WD')) return 'WD';
  if (desc === 'DQ' || name.includes('DQ')) return 'DQ';
  if (desc === 'MDF' || name.includes('MDF')) return 'MDF';

  if (linescores.length > 0) {
    // Cut detection by SCHEDULED rounds, not played rounds. ESPN pre-creates a
    // linescore ENTRY (0 holes) for every player scheduled to play a round; a
    // player who missed the cut gets NO entry for the rounds the field advances
    // to. So a player is cut iff their highest scheduled round is behind the
    // field's. Round count alone is ambiguous mid-event — a player who MADE the
    // cut but hasn't teed off R3 has the same 2 played rounds as one who missed
    // it. (`fieldMaxScheduled` is the max period entry across the whole field.)
    const playerScheduledMax = Math.max(...linescores.map(ls => ls.period));
    const roundsWithData = linescores.filter(ls => (ls.linescores ?? []).length > 0);
    const playerPlayedMax = roundsWithData.length ? Math.max(...roundsWithData.map(ls => ls.period)) : 0;
    const allPlayedComplete = roundsWithData.length > 0 && roundsWithData.every(ls => ls.linescores.length >= 18);

    if (allPlayedComplete && playerScheduledMax < fieldMaxScheduled) {
      if (fieldMaxScheduled >= 3 && playerPlayedMax <= 2) return 'CUT';
      if (fieldMaxScheduled >= 4 && playerPlayedMax === 3) return 'MDF';
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
  // Fail loudly on a massive partial-batch failure (e.g. ESPN slow, most
  // linescore fetches timed out). Returning a thin map silently would let the
  // caller treat half a field as complete and cache it — throw so it falls
  // through to the cache/last-resort path instead.
  if (allCompetitors.length > 0 && roundsMap.size < 0.5 * allCompetitors.length) {
    throw new Error(
      `[scores] Core API partial batch for ${espnTournamentId}: only ${roundsMap.size}/${allCompetitors.length} players fetched`
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

  // Fail loudly on a massive partial-batch failure rather than returning a
  // thin competitor list that would be treated as the full field.
  if (items.length > 0 && rawData.size < 0.5 * items.length) {
    throw new Error(
      `[scores] Core API partial batch for ${espnTournamentId}: only ${rawData.size}/${items.length} competitors fetched`
    );
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

/** Highest round number (1-4) present in a rounds object, or 0 if none. */
export function maxRoundKey(roundsObj) {
  let m = 0;
  for (const k of Object.keys(roundsObj ?? {})) {
    const n = parseInt(k, 10);
    if (!isNaN(n) && roundsObj[k] != null && n > m) m = n;
  }
  return m;
}

/**
 * Persist scores to the DB cache WITHOUT losing previously-cached data.
 *
 * Two safeguards protect against a transient/partial ESPN response corrupting
 * a good cache:
 *   1. Regression guard — refuse the whole write if the incoming field looks
 *      thinner than what's already cached (far fewer players, or a lower max
 *      round). A single bad fetch can't wipe out good data.
 *   2. Per-player round merge — a round already in the cache is never dropped
 *      just because this response omitted it. New values still win per round
 *      (so ESPN corrections apply); only deletions are prevented.
 *
 * Tradeoff: a round, once cached for a player, is effectively permanent. A rare
 * ESPN retroactive deletion (e.g. a post-hoc DQ wiping a round) won't shrink it.
 * Acceptable for integrity.
 */
export async function persistScoreCache(supabase, espnTournamentId, scoreMap) {
  try {
    // Read existing cache to merge against and to measure regression.
    const { data: existingRows } = await supabase
      .from('cached_player_scores')
      .select('player_espn_id, rounds_json')
      .eq('espn_tournament_id', espnTournamentId);
    const existingByPlayer = new Map();
    for (const row of existingRows ?? []) {
      existingByPlayer.set(row.player_espn_id, row.rounds_json ?? {});
    }

    // Only players with at least one real round are cacheable.
    const incoming = [...scoreMap].filter(
      ([, data]) => Object.keys(data.rounds ?? {}).length > 0
    );

    const existingCount = existingByPlayer.size;
    const newCount = incoming.length;
    let existingMaxRound = 0;
    for (const r of existingByPlayer.values()) {
      existingMaxRound = Math.max(existingMaxRound, maxRoundKey(r));
    }
    let newMaxRound = 0;
    for (const [, data] of incoming) {
      newMaxRound = Math.max(newMaxRound, maxRoundKey(data.rounds));
    }

    // Regression guard.
    if (existingCount > 0 && (newCount < 0.5 * existingCount || newMaxRound < existingMaxRound)) {
      console.warn(
        `[scores] regression-skip: refusing cache write for ${espnTournamentId} ` +
        `(incoming ${newCount}p/R${newMaxRound} vs cached ${existingCount}p/R${existingMaxRound})`
      );
      return;
    }

    const now = new Date().toISOString();
    const rows = incoming.map(([playerId, data]) => {
      // Merge: keep any cached round this response omitted; new values win per key.
      const mergedRounds = { ...(existingByPlayer.get(playerId) ?? {}), ...data.rounds };
      return {
        espn_tournament_id: espnTournamentId,
        player_espn_id: playerId,
        rounds_json: mergedRounds,
        thru: data.thru != null ? String(data.thru) : null,
        overall_status: data.overallStatus ?? null,
        total_score: data.totalScore ?? null,
        rank: data.rank ?? null,
        saved_at: now,
      };
    });
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
 * @returns {Promise<{ scoreMap: Map<string, object>, venue: { course: string|null, par: number|null }, source: string, competitorCount: number, maxRound: number }>}
 */
export async function fetchPlayerScores(supabase, espnTournamentId, status = '') {
  // Wrap every return with provenance metadata so callers (and the network tab)
  // can see where the data came from and whether it looks complete.
  const result = (scoreMap, venue, source) => {
    let maxRound = 0;
    for (const d of scoreMap.values()) maxRound = Math.max(maxRound, maxRoundKey(d.rounds));
    return { scoreMap, venue, source, competitorCount: scoreMap.size, maxRound };
  };

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
      // Validate cache completeness. A completed-event cache should have R4 data for
      // the players who made the cut; if it only goes to R3 it was likely written
      // mid-tournament (or from the wrong event) and we try a fresh ESPN pull first.
      // Genuine 54-hole events (no R4) will always refresh then serve cache via the
      // last-resort branch below — correct, just mildly less efficient.
      const hasFinalRoundData = cached.some(row => (row.rounds_json ?? {})['4'] != null);
      if (hasFinalRoundData) {
        console.log(`[scores] serving post-tournament cache for ${espnTournamentId}`);
        return result(buildScoreMapFromCache(cached), { course: null, par: null }, 'cache');
      }
      console.warn(`[scores] post-tournament cache for ${espnTournamentId} has no R4 data — trying ESPN refresh before using cache`);
      skipCache = true; // prevent the fallback path from re-serving this same stale data
    } else {
      console.warn(`[scores] no cache for completed tournament ${espnTournamentId}, falling back to ESPN`);
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
        console.log(`[scores] using DB-cached scores for ESPN tournament ${espnTournamentId}`);
        return result(buildScoreMapFromCache(rows), venue, 'cache');
      }
    }

    // Last resort: Core API retains historical data indefinitely.
    console.warn(`[scores] no scoreboard data for ${espnTournamentId}, attempting Core API fallback`);
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
        return result(scoreMap, venue, 'core');
      }
    } catch (coreErr) {
      console.error(`[scores] Core API fallback failed for ${espnTournamentId}:`, coreErr.message);
    }

    if (postCachedRows && postCachedRows.length > 0) {
      console.warn(`[scores] using existing post-tournament cache for ${espnTournamentId} after ESPN/Core fallback failed`);
      return result(buildScoreMapFromCache(postCachedRows), venue, 'cache-stale');
    }

    throw new Error(`No score data available for ESPN tournament ${espnTournamentId}`);
  }

  // First pass: determine the field's max SCHEDULED round (any entry, even 0
  // holes). ESPN creates a period entry for every player scheduled to play that
  // round but not for players who missed the cut — so this is how cut detection
  // tells "made the cut, hasn't teed off" from "cut" (both have the same
  // played-round count). Used only by deriveOverallStatus.
  let fieldMaxScheduled = 0;
  for (const c of competitors) {
    for (const ls of c.linescores ?? []) {
      if (ls.period > fieldMaxScheduled) fieldMaxScheduled = ls.period;
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
      overallStatus: deriveOverallStatus(c, linescores, fieldMaxScheduled),
      totalScore: String(c.score ?? '').trim(),
    });
  }

  // Maybe backfill missing rounds from the Core API. The trigger DEPENDS on status:
  //   - 'post' (completed event): a thin response is a real problem — ESPN clears
  //     linescores after events end — so backfill when <50% of the field has rounds.
  //   - live/'in': a thin response is EXPECTED early/mid-round (the morning wave
  //     hasn't posted yet). Backfilling here would be wrong, and stamping thru='F'
  //     over in-progress players is exactly the bug that made everyone read "F" on
  //     day 1. So only backfill when the Site gave essentially NO round data at all.
  // The Core API is round-level and carries no live "thru", so we only treat its
  // rounds as final ('F') for completed events — never override a live Site thru.
  let source = 'site';
  const total = scoreMap.size;
  const withRounds = [...scoreMap.values()].filter(d => Object.keys(d.rounds).length > 0).length;
  const completeFraction = total > 0 ? withRounds / total : 0;
  const deficient = status === 'post' ? completeFraction < 0.5 : withRounds === 0;
  if (deficient) {
    console.log(`[scores] deficient Site response for ${espnTournamentId} (${withRounds}/${total} have rounds, status=${status || 'n/a'}) — backfilling from Core API`);
    try {
      const coreRounds = await fetchRoundsFromCoreApi(espnTournamentId, [...scoreMap.keys()]);
      for (const [id, rounds] of coreRounds) {
        if (!scoreMap.has(id)) continue;
        const entry = scoreMap.get(id);
        // Merge rather than replace so a Site round isn't dropped if Core omits it.
        entry.rounds = { ...entry.rounds, ...rounds };

        const roundNums = Object.values(entry.rounds).map(s => {
          const t = String(s).trim().toUpperCase();
          if (t === 'E') return 0;
          const n = parseInt(t, 10);
          return isNaN(n) ? null : n;
        }).filter(n => n !== null);
        if (roundNums.length > 0) {
          const tot = roundNums.reduce((a, b) => a + b, 0);
          entry.totalScore = tot === 0 ? 'E' : tot > 0 ? `+${tot}` : String(tot);
        }

        // Core rounds are only "final" for completed events. For live, leave the
        // Site thru untouched (a number, or null → UI shows "—").
        if (status === 'post' && Object.keys(entry.rounds).length > 0) entry.thru = 'F';
      }
      source = 'site+core';
    } catch (err) {
      console.error(`[scores] Core API backfill failed for ${espnTournamentId}:`, err.message);
    }
  }

  // Third pass: compute display ranks
  computeRanks(scoreMap);

  // Persist to Supabase — round-preserving + regression-guarded (see persistScoreCache).
  await persistScoreCache(supabase, espnTournamentId, scoreMap);

  return result(scoreMap, venue, source);
}
