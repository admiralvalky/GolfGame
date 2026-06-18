// Dates are stored as T04:00Z (midnight US/Eastern) — the intended calendar day
// is the UTC date. Render in UTC so viewers west of Eastern don't see the prior
// day (e.g. "2026-06-18T04:00Z" must show Jun 18, not Jun 17 in Pacific time).
export function formatTournamentDates(t) {
  if (!t?.start_date) return '';
  const start = new Date(t.start_date);
  const year = start.getUTCFullYear();
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  if (t.end_date) {
    const end = new Date(t.end_date);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    return sameMonth
      ? `${start.toLocaleDateString('en-US', opts)}–${end.getUTCDate()}, ${year}`
      : `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${year}`;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 3);
  return `${start.toLocaleDateString('en-US', opts)}–${end.getUTCDate()}, ${year}`;
}

export function statusLabel(status) {
  const s = (status ?? '').toUpperCase();
  if (s.includes('IN_PROGRESS') || s === 'IN') return 'Live';
  if (s.includes('FINAL') || s === 'POST') return 'Final';
  if (s.includes('SCHEDULED') || s === 'UPCOMING') return 'Upcoming';
  return status ?? '';
}
