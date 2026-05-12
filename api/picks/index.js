import supabase from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/auth.js';
import { withHandler, parseIntParam } from '../_lib/handler.js';

export default withHandler(async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const tournamentId = parseIntParam(req.query.tournamentId);
    if (!tournamentId) return res.status(400).json({ error: 'tournamentId must be a positive integer' });

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
  if (parseIntParam(team_id) === null) {
    return res.status(400).json({ error: 'team_id must be a positive integer' });
  }
  if (parseIntParam(tournament_id) === null) {
    return res.status(400).json({ error: 'tournament_id must be a positive integer' });
  }
  if (players.length !== 6) {
    return res.status(400).json({ error: 'Exactly 6 players must be picked' });
  }

  const normalizedPlayers = players.map((p) => ({
    player_espn_id: String(p.player_espn_id ?? '').trim(),
    player_name: String(p.player_name ?? '').trim(),
  }));
  if (normalizedPlayers.some((p) => !p.player_espn_id || !p.player_name)) {
    return res.status(400).json({ error: 'Each player requires player_espn_id and player_name' });
  }
  if (new Set(normalizedPlayers.map((p) => p.player_espn_id)).size !== 6) {
    return res.status(400).json({ error: 'Duplicate players are not allowed' });
  }

  const { data: team } = await supabase.from('teams').select('id').eq('id', team_id).single();
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { data: tournament } = await supabase.from('tournaments').select('id').eq('id', tournament_id).single();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  const { data: saved, error } = await supabase.rpc('replace_team_picks', {
    p_team_id: team_id,
    p_tournament_id: tournament_id,
    p_players: normalizedPlayers,
  });

  if (!error) return res.status(201).json({ picks: saved });

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.message?.includes('replace_team_picks') ||
    error.message?.includes('Could not find the function');
  if (!isMissingRpc) return res.status(500).json({ error: error.message });

  console.warn('replace_team_picks RPC is missing; using non-transactional fallback. Run supabase/migrations/20240101_init.sql to enable atomic pick saves.');

  const { error: deleteError } = await supabase
    .from('picks')
    .delete()
    .eq('team_id', team_id)
    .eq('tournament_id', tournament_id);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  const rows = normalizedPlayers.map((p) => ({
    team_id,
    tournament_id,
    player_espn_id: p.player_espn_id,
    player_name: p.player_name,
  }));

  const { data: fallbackSaved, error: insertError } = await supabase
    .from('picks')
    .insert(rows)
    .select();

  if (insertError) return res.status(500).json({ error: insertError.message });
  return res.status(201).json({ picks: fallbackSaved });
});
