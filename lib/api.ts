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

export function useApi<T>(url: string | null) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!url });
  useEffect(() => {
    if (!url) return;
    let live = true;
    set({ loading: true });
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((d) => live && set({ data: d, loading: false }))
      .catch((e) => live && set({ error: String(e.message ?? e), loading: false }));
    return () => { live = false; };
  }, [url]);
  return state;
}
