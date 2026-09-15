"use client";
import { useEffect, useState } from "react";
import { fetchJson, type Item } from "./api";

type State = { key: string; map: Map<string, Item[]>; done: number; current: string; error?: string };

/** One /api/search per keyword, two in flight; results keyed by the keyword list so a new list shows fresh state without resets. */
export function useCatalogue(keywords: string[]) {
  const key = keywords.join("|");
  const [st, setSt] = useState<State>();
  useEffect(() => {
    const kws = key ? key.split("|") : [];
    if (!kws.length) return;
    const ctrl = new AbortController(); const map = new Map<string, Item[]>();
    let done = 0, next = 0, error: string | undefined;
    const publish = () => setSt({ key, map: new Map(map), done, current: kws[next] ?? "", error });
    const worker = async () => {
      while (next < kws.length && !ctrl.signal.aborted) {
        const k = kws[next++];
        try { map.set(k, await fetchJson<Item[]>(`/api/search?q=${encodeURIComponent(k)}&offers=false&new=false`, ctrl.signal)); }
        catch (e) { if (ctrl.signal.aborted) return; error = String((e as Error).message ?? e); }
        done++; publish();
      }
    };
    Promise.all([worker(), worker()]);
    return () => ctrl.abort();
  }, [key]);
  const cur = st?.key === key ? st : { key, map: new Map<string, Item[]>(), done: 0, current: keywords[0] ?? "", error: undefined };
  return { ...cur, total: keywords.length, loading: keywords.length > 0 && cur.done < keywords.length };
}
