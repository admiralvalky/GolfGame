import { normalizeStatus } from './espn.js';

/**
 * Override a DB-stored status based on current date to prevent stale values.
 *
 * Rules (evaluated in order):
 *  1. start_date in future → 'upcoming'
 *  2. Within active window (start ≤ now ≤ end+1day) AND status ≠ 'post' → 'in'
 *     The +1 day buffer handles timezone drift: dates stored at T04:00Z
 *     (midnight US/Eastern) can expire before the tournament actually ends
 *     in the evening. This ensures ESPN is queried live on finals day.
 *  3. end+1day passed AND status was 'upcoming' → 'post' (missed admin update)
 *  4. status is 'post' but end+3days hasn't passed → 'in' (premature post / wrong end_date)
 *  5. Otherwise → normalized DB status
 */
export function clampStatusByDate(status, startDate, endDate, now = new Date()) {
  const normalized = normalizeStatus(status);

  // Rule 1: not started yet
  if (startDate && new Date(startDate) > now) return 'upcoming';

  if (endDate) {
    const dayAfterEnd = new Date(endDate);
    dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);

    // Rule 2: active window — keep live ESPN data flowing on tournament days
    if (normalized !== 'post' && startDate && now <= dayAfterEnd) return 'in';

    // Rule 3: fully over, admin forgot to update
    if (dayAfterEnd < now && normalized === 'upcoming') return 'post';

    // Rule 4: admin marked 'post' too early — grace window reverts to 'in'
    const graceCutoff = new Date(endDate);
    graceCutoff.setDate(graceCutoff.getDate() + 3);
    if (normalized === 'post' && now <= graceCutoff) return 'in';
  }

  return normalized;
}

/**
 * Returns a tournament object with `status` overridden by `clampStatusByDate`.
 * Use this everywhere a tournament's effective status matters — the DB value
 * may be stale if admins forgot to update it after a tournament ended.
 */
export function withEffectiveStatus(tournament) {
  if (!tournament) return tournament;
  return {
    ...tournament,
    status: clampStatusByDate(tournament.status, tournament.start_date, tournament.end_date),
  };
}
