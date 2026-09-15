"use client";
import { useSyncExternalStore } from "react";

/** Tiny persisted store: localStorage + cross-component/tab subscription, hydration-safe (server sees `fallback`). */
export function createLocalStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } = { raw: null, value: fallback };
  const read = (): T => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch {}
    if (raw !== cache.raw) cache = { raw, value: raw ? (JSON.parse(raw) as T) : fallback };
    return cache.value;
  };
  const write = (v: T) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} listeners.forEach((l) => l()); };
  const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
  const use = () => [useSyncExternalStore(subscribe, read, () => fallback), write] as const;
  return { use, read, write };
}
