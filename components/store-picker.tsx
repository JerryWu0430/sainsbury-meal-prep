"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type NearbyStore } from "@/lib/api";
import { useStore } from "@/lib/store-context";

export function StorePicker() {
  const { code, setCode } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const { data, loading, error } = useApi<{ label: string; stores: NearbyStore[] }>(q ? `/api/stores?q=${encodeURIComponent(q)}` : null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" />}>Change</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-normal">Choose your Sainsbury&apos;s</DialogTitle>
          <DialogDescription>Postcode, outcode or place — e.g. SE1 6TJ, SW9, Brixton.</DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(draft.trim()); }}>
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Where are you?" />
          <Button type="submit">Find</Button>
        </form>
        {error && <p className="text-destructive text-sm">{error.includes("404") ? "Couldn't find that place." : error}</p>}
        {loading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {data && (
          <ul className="max-h-80 divide-y overflow-y-auto text-sm">
            {data.stores.map((s) => (
              <li key={s.code}>
                <button type="button" onClick={() => { setCode(s.code); setOpen(false); }}
                  className="hover:bg-accent flex w-full items-center gap-3 px-1 py-2 text-left transition-colors duration-150" aria-current={s.code === code}>
                  <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${s.open_now ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.name}</span>
                    {s.code === code && <span className="text-muted-foreground"> · current</span>}
                    <span className="text-muted-foreground block truncate text-xs">{s.address}</span>
                  </span>
                  <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                  <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">{s.km.toFixed(1)} km</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
