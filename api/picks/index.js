import supabase from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const tournamentId = req.query.tournamentId;
    if (!tournamentId) return res.status(400).json({ error: 'tournamentId query parameter required' });

    const { data: picks, error } = await supabase
      .from('picks')
      .select('*, teams!inner(name)')
      .eq('tournament_id', tournamentId)
      .order('player_name');

    if (error) return res.status(500).json({ error: error.message });

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

    return res.json({ picks: Object.values(byTeam) });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { team_id, tournament_id, players } = req.body;

  if (!team_id || !tournament_id || !Array.isArray(players)) {
    return res.status(400).json({ error: 'team_id, tournament_id, and players array required' });
  }
  if (players.length !== 6) {
    return res.status(400).json({ error: 'Exactly 6 players must be picked' });
  }

  // Verify team exists
  const { data: team } = await supabase.from('teams').select('id').eq('id', team_id).single();
  if (!team) return res.status(404).json({ error: 'Team not found' });

  // Verify tournament exists
  const { data: tournament } = await supabase.from('tournaments').select('id').eq('id', tournament_id).single();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  // Delete existing picks for this team/tournament
  await supabase
    .from('picks')
    .delete()
    .eq('team_id', team_id)
    .eq('tournament_id', tournament_id);

  // Insert new picks
  const rows = players.map((p) => ({
    team_id,
    tournament_id,
    player_espn_id: p.player_espn_id,
    player_name: p.player_name,
  }));

  const { data: saved, error } = await supabase
    .from('picks')
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ picks: saved });
}
