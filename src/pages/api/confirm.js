import { createSupabaseServerClient } from './_supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { reservation_id } = req.body || {};
  if (!reservation_id) return res.status(400).json({ error: 'reservation_id required' });

  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase.rpc('confirm_pod', { p_reservation_id: reservation_id });
    if (error) {
      console.error('confirm rpc error', error);
      return res.status(500).json({ error: 'Confirm failed' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}