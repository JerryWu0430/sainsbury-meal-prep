import { useEffect, useState } from "react";

export type Item = {
  uid: string; name: string; price: number | null; was: number | null; pct: number; unit: string;
  promo: string; nectar: boolean; ends: string; life: string; available: boolean; url: string;
  image: string; thumb: string;
};
export type Idea = { idea: string; items: Item[]; cost: number; per_portion: number };
export type Plan = { picks: Record<string, Item[]>; ideas: Idea[] };
export type NearbyStore = { code: string; name: string; type: string; address: string; km: number; open_now: boolean | null; open_until: string | null };
export type Store = {
  name: string; code: string; address: string; tel: string; status: string;
  open_now: { is_open: boolean; open_until: string } | null;
  hours: [string, string][]; facilities: string[];
};

// in-memory cache: survives route changes within the tab (React state doesn't); CDN handles cross-session
const mem = new Map<string, unknown>();

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (mem.has(url)) return mem.get(url) as T;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const d = (await r.json()) as T;
  mem.set(url, d);
  return d;
}

export function useApi<T>(url: string | null): { data?: T; error?: string; loading: boolean } {
  const [st, setSt] = useState<{ url: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!url || mem.has(url)) return;
    const ctrl = new AbortController();
    fetchJson<T>(url, ctrl.signal)
      .then((data) => setSt({ url, data }))
      .catch((e) => { if (!ctrl.signal.aborted) setSt({ url, error: String(e.message ?? e) }); });
    return () => ctrl.abort();
  }, [url]);
  if (!url) return { loading: false };
  if (st?.url === url) return { data: st.data, error: st.error, loading: false };
  if (mem.has(url)) return { data: mem.get(url) as T, loading: false };
  return { loading: true };
}
