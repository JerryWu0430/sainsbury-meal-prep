"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsTable } from "@/components/items-table";
import { useApi, type Item } from "@/lib/api";

type Props = { path: "offers" | "new" | "search"; placeholder: string; hasMin?: boolean; required?: boolean };

export function Listing({ path, placeholder, hasMin = false, required = false }: Props) {
  const [draft, setDraft] = useState("");
  const [kw, setKw] = useState("");
  const [min, setMin] = useState(hasMin ? 20 : 0);
  const [offersOnly, setOffersOnly] = useState(false);
  const p = new URLSearchParams();
  if (kw) p.set(path === "search" ? "q" : "kw", kw);
  if (hasMin && min) p.set("min", String(min));
  if (path === "search" && offersOnly) p.set("offers", "true");
  const { data, loading, error } = useApi<Item[]>(required && !kw ? null : `/api/${path}?${p}`);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setKw(draft.trim()); }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="basis-full sm:basis-auto sm:flex-1" />
        {hasMin && (
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            min
            <Input type="number" className="w-16 tabular-nums" value={min} min={0} max={90} onChange={(e) => setMin(+e.target.value)} aria-label="minimum % off" />
            % off
          </label>
        )}
        {path === "search" && (
          <Button type="button" variant={offersOnly ? "default" : "outline"} aria-pressed={offersOnly} onClick={() => setOffersOnly(!offersOnly)}>Offers only</Button>
        )}
        <Button type="submit" className="ml-auto sm:ml-0">Go</Button>
      </form>
      <p className="text-muted-foreground text-xs">
        {loading ? "Scraping live — first load takes ~20s, then cached 6h" : data ? `${data.length} items` : required ? "Type to search" : ""}
      </p>
      <ItemsTable items={data} loading={loading} error={error} />
    </div>
  );
}
