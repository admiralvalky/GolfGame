import supabase from './_lib/supabase.js';
import { withHandler } from './_lib/handler.js';

export default withHandler(async function handler(req, res) {
  const { error } = await supabase
    .from('tournaments')
    .select('id')
    .limit(1);

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});
