"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemsTable } from "@/components/items-table";
import { MealPrep } from "@/components/mealprep";
import { StoreCard } from "@/components/store-card";
import { useApi, type Item } from "@/lib/api";

function Listing({ path, placeholder, hasMin = false, required = false }: { path: "offers" | "new" | "search"; placeholder: string; hasMin?: boolean; required?: boolean }) {
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
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setKw(draft.trim()); }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
        {hasMin && <Input type="number" className="w-24" value={min} min={0} max={90} onChange={(e) => setMin(+e.target.value)} aria-label="min % off" title="min % off" />}
        {path === "search" && <Button type="button" variant={offersOnly ? "default" : "outline"} onClick={() => setOffersOnly(!offersOnly)}>offers</Button>}
        <Button type="submit">Go</Button>
      </form>
      {data && <p className="text-muted-foreground text-xs">{data.length} items{loading ? "" : " · cached up to 6h"}</p>}
      <ItemsTable items={data} loading={loading} error={error} />
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sainsbury&apos;s · Elephant &amp; Castle</h1>
        <StoreCard />
      </header>
      <Tabs defaultValue="offers">
        <TabsList>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="new">New in</TabsTrigger>
          <TabsTrigger value="mealprep">Meal prep</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        <TabsContent value="offers"><Listing path="offers" placeholder="keywords, comma-separated (default: staples)" hasMin /></TabsContent>
        <TabsContent value="new"><Listing path="new" placeholder="keywords, comma-separated (default: meal, chicken, snack…)" /></TabsContent>
        <TabsContent value="mealprep"><MealPrep /></TabsContent>
        <TabsContent value="search"><Listing path="search" placeholder="search products…" required /></TabsContent>
      </Tabs>
      <footer className="text-muted-foreground text-xs">Online range ≠ in-store shelf. Responses cached 6h. Be nice to Sainsbury&apos;s servers.</footer>
    </main>
  );
}
