"use client";
import { useSyncExternalStore } from "react";
import type { Item } from "./api";

export type Fav = Item & { savedAt: string; savedPrice: number | null };
const KEY = "sains_favs";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Fav[] } = { raw: null, value: [] };

function read(): Fav[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw !== cache.raw) cache = { raw, value: raw ? (JSON.parse(raw) as Fav[]) : [] }; // stable reference when unchanged
  return cache.value;
}
function write(favs: Fav[]) {
  try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb); window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const EMPTY: Fav[] = [];

export function useFavourites() {
  const favs = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = (uid: string) => favs.some((f) => f.uid === uid);
  const toggle = (i: Item) => write(has(i.uid) ? favs.filter((f) => f.uid !== i.uid) : [...favs, { ...i, savedAt: new Date().toISOString(), savedPrice: i.price }]);
  const refresh = (fresh: Item[]) => write(favs.map((f) => { const n = fresh.find((x) => x.uid === f.uid); return n ? { ...f, ...n } : f; }));
  const remove = (uid: string) => write(favs.filter((f) => f.uid !== uid));
  return { favs, has, toggle, refresh, remove };
}
