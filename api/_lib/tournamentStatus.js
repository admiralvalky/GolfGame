import { normalizeStatus } from './espn.js';

/**
 * Override a DB-stored status based on current date to prevent stale values.
 * Rules:
 *   - start_date in the future → 'upcoming' (regardless of DB status)
 *   - end_date in the past AND DB status was 'upcoming' → 'post' (tournament ended without status update)
 *   - otherwise → normalized DB status
 */
export function clampStatusByDate(status, startDate, endDate, now = new Date()) {
  const normalized = normalizeStatus(status);
  if (startDate && new Date(startDate) > now) return 'upcoming';
  if (endDate && new Date(endDate) < now && normalized === 'upcoming') return 'post';
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
