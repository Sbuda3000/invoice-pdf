const BASE = process.env.VITE_API_BASE || '';

export async function reservePod(reserved_by, metadata = {}) {
  const res = await fetch(`${BASE}/api/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reserved_by, metadata })
  });

  if (!res.ok) throw new Error("Reserve failed");
  return res.json(); // returns: { reservation_id, pod_number, ... }
}

export async function releasePod(reservation_id) {
  const res = await fetch(`${BASE}/api/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservation_id })
  });

  if (!res.ok) throw new Error("Release failed");
  return res.json();
}

export async function confirmPod(reservation_id) {
  const res = await fetch(`${BASE}/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservation_id })
  });

  if (!res.ok) throw new Error("Confirm failed");
  return res.json();
}