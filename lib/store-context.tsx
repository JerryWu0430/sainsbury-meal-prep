"use client";
import { createContext, useContext, useSyncExternalStore } from "react";

export const DEFAULT_STORE = "2499"; // Elephant & Castle
const KEY = "sains_store";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) ?? DEFAULT_STORE; } catch { return DEFAULT_STORE; } };
const subscribe = (cb: () => void) => {
  listeners.add(cb); window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const setCode = (c: string) => { try { localStorage.setItem(KEY, c); } catch {} listeners.forEach((l) => l()); };

const Ctx = createContext<{ code: string; setCode: (c: string) => void }>({ code: DEFAULT_STORE, setCode });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const code = useSyncExternalStore(subscribe, read, () => DEFAULT_STORE); // server renders the default, client swaps in the saved store
  return <Ctx value={{ code, setCode }}>{children}</Ctx>;
}

export const useStore = () => useContext(Ctx);
