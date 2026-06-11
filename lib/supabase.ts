// Lightweight Supabase REST client. Avoids adding @supabase/supabase-js as a dependency
// for v1; swap to the official SDK when more endpoints are needed.

export type ProspectRow = {
  email: string;
  source_page: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function insertProspect(row: ProspectRow): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Stub success so the success-state UI renders; log so the dev knows.
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[supabase] not configured; would insert prospect', row);
    }
    return { ok: true };
  }
  try {
    const res = await fetch(`${url}/rest/v1/prospects`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) return { ok: false, error: `Supabase ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
