import { normalizeStatus } from './espn.js';

/**
 * Override a DB-stored status based on the current date. The calendar window is
 * authoritative — a stale DB value (e.g. left on 'in' weeks later) is corrected.
 *
 * Rules (evaluated in order):
 *  1. start_date in the future → 'upcoming' (regardless of stored status)
 *  2. now is past end_date + 1 day → 'post' (over, regardless of stored status —
 *     this is what un-sticks a tournament left on 'in')
 *  3. now is within [start_date, end_date + 1 day] and it has started → 'in'
 *     The +1 day buffer absorbs timezone drift: dates stored at T04:00Z
 *     (midnight US/Eastern) expire before the tournament actually ends in the
 *     evening, so this keeps ESPN queried live through finals day.
 *  4. Otherwise → normalized DB status
 */
export function clampStatusByDate(status, startDate, endDate, now = new Date()) {
  const normalized = normalizeStatus(status);

  // Rule 1: not started yet
  if (startDate && new Date(startDate) > now) return 'upcoming';

  if (endDate) {
    const dayAfterEnd = new Date(endDate);
    dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);

    // Rule 2: window has passed → definitively over, even if DB still says 'in'
    if (now > dayAfterEnd) return 'post';

    // Rule 3: inside active window and started → live
    if (startDate && new Date(startDate) <= now) return 'in';
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
