"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type Plan } from "@/lib/api";
import { ItemsTable, Thumb } from "./items-table";

export function MealPrep() {
  const [full, setFull] = useState(false);
  const { data, loading, error } = useApi<Plan>(`/api/mealprep?full=${full}`);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" aria-pressed={full} onClick={() => setFull(!full)}>{full ? "Full search" : "Quick search"}</Button>
        <span className="text-muted-foreground text-xs">
          {loading ? "Scraping live — 20–40s cold, then cached 6h" : "4 portions each · prices are today's offer prices"}
        </span>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {loading && <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {data && (
        <div className="stagger grid gap-4 md:grid-cols-3">
          {data.ideas.map((idea, n) => (
            <Card key={idea.idea} style={{ "--i": n } as React.CSSProperties}>
              <CardHeader>
                <div className="mb-2 flex -space-x-2">{idea.items.map((i) => <Thumb key={i.uid} src={i.thumb} size={36} />)}</div>
                <CardTitle className="font-serif text-lg leading-snug font-normal">{idea.idea}</CardTitle>
                <p className="text-muted-foreground text-sm tabular-nums">≈ £{idea.cost.toFixed(2)} · £{idea.per_portion.toFixed(2)}/portion</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {idea.items.map((i) => (
                    <li key={i.uid} className="flex justify-between gap-3">
                      <a href={i.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">{i.name}</a>
                      <span className="tabular-nums">£{i.price?.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && Object.entries(data.picks).map(([g, items]) => (
        <section key={g} className="space-y-2">
          <h2 className="font-serif text-xl capitalize">{g}</h2>
          <ItemsTable items={items} loading={false} />
        </section>
      ))}
    </div>
  );
}
