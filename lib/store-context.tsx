"use client";
import { createContext, useContext, useEffect, useState } from "react";

export const DEFAULT_STORE = "2499"; // Elephant & Castle
const KEY = "sains_store";
const Ctx = createContext<{ code: string; setCode: (c: string) => void }>({ code: DEFAULT_STORE, setCode: () => {} });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [code, set] = useState(DEFAULT_STORE);
  useEffect(() => { try { const c = localStorage.getItem(KEY); if (c) set(c); } catch {} }, []);
  const setCode = (c: string) => { set(c); try { localStorage.setItem(KEY, c); } catch {} };
  return <Ctx value={{ code, setCode }}>{children}</Ctx>;
}

export const useStore = () => useContext(Ctx);
