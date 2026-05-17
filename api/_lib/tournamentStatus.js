import { normalizeStatus } from './espn.js';

/**
 * Override a DB-stored status based on current date to prevent stale values.
 * Rules:
 *   - start_date in the future → 'upcoming' (regardless of DB status)
 *   - end_date in the past AND DB status was 'upcoming' → 'post' (missed update)
 *   - status is 'post' BUT end_date was within the last 3 days → revert to 'in'
 *     (guards against wrong end_date or admin marking post a day too early;
 *      the tournament may still be live on ESPN — 3-day grace then it sticks)
 *   - otherwise → normalized DB status
 */
export function clampStatusByDate(status, startDate, endDate, now = new Date()) {
  const normalized = normalizeStatus(status);
  if (startDate && new Date(startDate) > now) return 'upcoming';
  if (endDate && new Date(endDate) < now && normalized === 'upcoming') return 'post';
  // Grace window: don't trust 'post' if end_date was within last 3 days.
  // Handles wrong end_date (e.g. May 16 when tournament runs to May 18)
  // or admin clicking "Final" one day too early.
  if (normalized === 'post' && endDate) {
    const graceCutoff = new Date(endDate);
    graceCutoff.setDate(graceCutoff.getDate() + 3);
    if (now <= graceCutoff) return 'in';
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
