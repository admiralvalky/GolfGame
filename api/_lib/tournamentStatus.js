import { normalizeStatus } from './espn.js';

export function clampStatusByDate(status, startDate, endDate, now = new Date()) {
  const normalized = normalizeStatus(status);
  if (startDate && new Date(startDate) > now) return 'upcoming';
  if (endDate && new Date(endDate) < now && normalized === 'upcoming') return 'post';
  return normalized;
}

export function withEffectiveStatus(tournament) {
  if (!tournament) return tournament;
  return {
    ...tournament,
    status: clampStatusByDate(tournament.status, tournament.start_date, tournament.end_date),
  };
}
