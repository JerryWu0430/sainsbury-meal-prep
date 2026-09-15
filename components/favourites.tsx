"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemsTable } from "@/components/items-table";
import { fetchJson, type Item } from "@/lib/api";
import { useFavourites } from "@/lib/favourites";
import { SuccessCheck, TextSwap } from "@/lib/transitions";

export function Favourites() {
  const { favs, refresh } = useFavourites();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(0); // bumps per successful refresh so the check replays
  async function refreshPrices() {
    setBusy(true); setNote("");
    try {
      const fresh = await fetchJson<Item[]>(`/api/items?uids=${favs.map((f) => f.uid).join(",")}&_=${Date.now()}`);
      refresh(fresh);
      const drops = fresh.filter((n) => { const f = favs.find((x) => x.uid === n.uid); return f?.savedPrice != null && n.price != null && n.price < f.savedPrice; }).length;
      setNote(`Refreshed ${fresh.length} · ${drops} cheaper than when saved · ${fresh.filter((n) => n.pct > 0).length} on offer`);
      setDone((n) => n + 1);
    } catch (e) { setNote(String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }
  if (favs.length === 0) return <p className="text-muted-foreground text-sm">Nothing starred yet — tap ☆ on any item in Offers, New in or Search.</p>;
  const sorted = [...favs].sort((a, b) => b.pct - a.pct || (a.price ?? 0) - (b.price ?? 0));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={refreshPrices} disabled={busy}>{busy ? "Checking…" : "Refresh prices"}</Button>
        <SuccessCheck token={done} className="text-emerald-700 dark:text-emerald-400" />
        <span role="status" aria-live="polite" className="text-muted-foreground text-xs">
          <TextSwap>{note || `${favs.length} saved · one request refreshes them all · the ☆ removes`}</TextSwap>
        </span>
      </div>
      <ItemsTable items={sorted} loading={false} />
    </div>
  );
}
