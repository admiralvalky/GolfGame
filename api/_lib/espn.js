const UA = 'Mozilla/5.0 (compatible; GolfPoolApp/1.0)';

export async function espnFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
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
    const playerMaxRound = Math.max(...linescores.map(ls => ls.period));
    const allRoundsComplete = linescores.every(ls => (ls.linescores ?? []).length >= 18);
    if (allRoundsComplete) {
      if (maxRound >= 3 && playerMaxRound <= 2) return 'CUT';
      if (maxRound >= 4 && playerMaxRound === 3) return 'MDF';
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
  const latestRound = linescores.reduce(
    (max, ls) => (ls.period > max.period ? ls : max),
    linescores[0]
  );
  const holesPlayed = (latestRound.linescores ?? []).length;
  if (holesPlayed === 0) return null;
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

  const res = await fetch(competitorsUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Core API competitors fetch failed: ${res.status}`);
  const json = await res.json();
  const allCompetitors = (json.items ?? []).filter(c => idSet.size === 0 || idSet.has(c.id));

  const roundsMap = new Map();
  const BATCH = 20;
  for (let i = 0; i < allCompetitors.length; i += BATCH) {
    await Promise.all(
      allCompetitors.slice(i, i + BATCH).map(async (comp) => {
        try {
          const lsRes = await fetch(`${baseUrl}/competitors/${comp.id}/linescores?lang=en&region=us`, {
            headers: { 'User-Agent': UA },
          });
          if (!lsRes.ok) return;
          const lsJson = await lsRes.json();
          const rounds = {};
          for (const ls of lsJson.items ?? []) {
            if (ls.period && ls.displayValue != null) {
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

export async function fetchPlayerScores(supabase, espnTournamentId, status = '') {
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${espnTournamentId}`;
  let competitors = [];
  let venue = { course: null, par: null };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const json = await res.json();
      competitors = json.events?.[0]?.competitions?.[0]?.competitors ?? [];
      const comp = json.events?.[0]?.competitions?.[0];
      venue = {
        course: comp?.venue?.fullName ?? null,
        par: comp?.course?.par ?? comp?.situation?.par ?? null,
      };
    }
  } catch (err) {
    console.error(`ESPN fetch failed for ${espnTournamentId}:`, err.message);
  }

  // If ESPN returned no data, fall back to DB cache
  if (competitors.length === 0) {
    const { data: rows } = await supabase
      .from('cached_player_scores')
      .select('*')
      .eq('espn_tournament_id', espnTournamentId);

    if (rows && rows.length > 0) {
      console.log(`Using DB-cached scores for ESPN tournament ${espnTournamentId}`);
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
      return { scoreMap, venue };
    }
    throw new Error(`No score data available for ESPN tournament ${espnTournamentId}`);
  }

  // First pass: determine max round
  let maxRound = 0;
  for (const c of competitors) {
    for (const ls of c.linescores ?? []) {
      if (ls.period > maxRound) maxRound = ls.period;
    }
  }

  // Second pass: build scoreMap
  const scoreMap = new Map();
  for (const c of competitors) {
    const linescores = c.linescores ?? [];
    const rounds = {};
    for (const ls of linescores) {
      if (ls.period && ls.displayValue != null && ls.displayValue.trim() !== '') {
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
  const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);
  const active = [];
  for (const [id, data] of scoreMap) {
    if (!CUT_STATUSES.has(data.overallStatus)) {
      const s = data.totalScore.toUpperCase();
      const n = s === 'E' ? 0 : parseInt(s, 10);
      if (!isNaN(n)) active.push({ id, score: n });
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

  // Persist to Supabase
  try {
    const now = new Date().toISOString();
    const rows = [...scoreMap].map(([playerId, data]) => ({
      espn_tournament_id: espnTournamentId,
      player_espn_id: playerId,
      rounds_json: data.rounds,
      thru: data.thru != null ? String(data.thru) : null,
      overall_status: data.overallStatus ?? null,
      total_score: data.totalScore ?? null,
      rank: data.rank ?? null,
      saved_at: now,
    }));
    await supabase
      .from('cached_player_scores')
      .upsert(rows, { onConflict: 'espn_tournament_id,player_espn_id' });
  } catch (err) {
    console.error('Failed to cache scores to DB:', err.message);
  }

  return { scoreMap, venue };
}
