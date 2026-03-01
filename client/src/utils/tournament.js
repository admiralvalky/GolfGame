export function formatTournamentDates(t) {
  if (!t?.start_date) return '';
  const start = new Date(t.start_date);
  const opts = { month: 'short', day: 'numeric' };
  if (t.end_date) {
    const end = new Date(t.end_date);
    const sameMonth = start.getMonth() === end.getMonth();
    return sameMonth
      ? `${start.toLocaleDateString('en-US', opts)}–${end.getDate()}`
      : `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  }
  // Fallback: assume 4-day event
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  return `${start.toLocaleDateString('en-US', opts)}–${end.getDate()}`;
}

export function statusLabel(status) {
  const s = (status ?? '').toUpperCase();
  if (s.includes('IN_PROGRESS') || s === 'IN') return 'Live';
  if (s.includes('FINAL') || s === 'POST') return 'Final';
  if (s.includes('SCHEDULED') || s === 'UPCOMING') return 'Upcoming';
  return status ?? '';
}
