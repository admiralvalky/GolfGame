import supabase from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tournamentId } = req.query;

  const { data: picks, error } = await supabase
    .from('picks')
    .select('*, teams!inner(name)')
    .eq('tournament_id', tournamentId)
    .order('player_name');

  if (error) return res.status(500).json({ error: error.message });

  // Group by team
  const byTeam = {};
  for (const pick of picks) {
    if (!byTeam[pick.team_id]) {
      byTeam[pick.team_id] = {
        team_id: pick.team_id,
        team_name: pick.teams.name,
        players: [],
      };
    }
    byTeam[pick.team_id].players.push({
      id: pick.id,
      player_espn_id: pick.player_espn_id,
      player_name: pick.player_name,
    });
  }

  res.json({ picks: Object.values(byTeam) });
}
