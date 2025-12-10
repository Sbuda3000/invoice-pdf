import { createSupabaseServerClient } from './_supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { reserved_by = null, metadata = {} } = req.body || {};
  const supabase = createSupabaseServerClient();
  const client = supabase; // will use RPC through SQL (we'll use raw SQL via Postgres)

  try {
    // We execute a transaction using Postgres function via Postgres REST (via SQL)
    // Supabase JS doesn't expose a transaction easily, so use Postgres SQL via rpc: perform atomic update + insert
    // We'll run a SQL block via REST 'rpc' style using 'pg' via supabase? Simpler: use SQL through 'rpc' function.
    // Create a SQL function in Supabase first (see instructions below).
    const { data, error } = await client.rpc('reserve_pod', {
      p_reserved_by: reserved_by,
      p_metadata: JSON.stringify(metadata)
    });

    if (error) {
      console.error('reserve rpc error', error);
      return res.status(500).json({ error: 'Reserve failed' });
    }
    // RPC returns reservation row
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
