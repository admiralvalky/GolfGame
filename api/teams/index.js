import supabase from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ teams });
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Team name already exists' });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ team });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query parameter required' });
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
