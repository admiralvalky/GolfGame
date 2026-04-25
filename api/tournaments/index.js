import supabase from '../_lib/supabase.js';
import { requireAdmin } from '../_lib/auth.js';
import { normalizeStatus } from '../_lib/espn.js';
import { clampStatusByDate, withEffectiveStatus } from '../_lib/tournamentStatus.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ tournaments: tournaments.map(withEffectiveStatus) });
  }

  if (req.method === 'POST') {
    const { espn_tournament_id, name, start_date, end_date, status } = req.body;
    if (!espn_tournament_id || !name) {
      return res.status(400).json({ error: 'espn_tournament_id and name are required' });
    }

    const normalizedStatus = clampStatusByDate(normalizeStatus(status), start_date, end_date);

    // Check if already exists
    const { data: existing } = await supabase
      .from('tournaments')
      .select('*')
      .eq('espn_tournament_id', espn_tournament_id)
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('tournaments')
        .update({
          status: normalizedStatus ?? existing.status,
          name,
          end_date: end_date ?? existing.end_date ?? null,
        })
        .eq('espn_tournament_id', espn_tournament_id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ tournament: updated });
    }

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        espn_tournament_id,
        name,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        status: normalizedStatus ?? 'upcoming',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ tournament });
  }

  if (req.method === 'PATCH') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id query parameter required' });
    const { status, end_date } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const { data: existing } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .update({
        status: normalizeStatus(status),
        end_date: end_date ?? existing?.end_date ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    return res.json({ tournament });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query parameter required' });
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
