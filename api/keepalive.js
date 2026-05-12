import supabase from './_lib/supabase.js';
import { withHandler } from './_lib/handler.js';

export default withHandler(async function handler(req, res) {
  // Ping Supabase to prevent free-tier sleep.
  const { data: tournamentRows, error } = await supabase
    .from('tournaments')
    .select('id');

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  // Prune orphaned cached_team_scores rows for deleted tournaments.
  // These accumulate silently when tournaments are removed from the DB.
  const validIds = (tournamentRows ?? []).map(r => r.id);
  if (validIds.length > 0) {
    await supabase
      .from('cached_team_scores')
      .delete()
      .not('tournament_id', 'in', `(${validIds.join(',')})`);
  }

  res.status(200).json({ ok: true, ts: new Date().toISOString(), tournaments: validIds.length });
});
