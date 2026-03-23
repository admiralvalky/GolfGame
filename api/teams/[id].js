import supabase from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  // CASCADE handles picks and tournament_scores deletion via foreign keys
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
}
