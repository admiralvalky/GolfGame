import supabase from '../../_lib/supabase.js';
import { normalizeStatus } from '../../_lib/espn.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
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
  res.json({ tournament });
}
