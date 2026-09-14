"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi, type Plan } from "@/lib/api";
import { ItemsTable } from "./items-table";

export function MealPrep() {
  const [full, setFull] = useState(false);
  const { data, loading, error } = useApi<Plan>(`/api/mealprep?full=${full}`);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={full ? "default" : "outline"} onClick={() => setFull(!full)}>{full ? "full search" : "quick search"}</Button>
        <span className="text-muted-foreground text-xs">{loading ? "scraping… ~20–40s cold, then cached 6h" : "batch-cook ideas from current offers · 4 portions"}</span>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.ideas ?? []).map((idea, n) => (
          <Card key={n}>
            <CardHeader>
              <CardTitle className="text-base">{idea.idea}</CardTitle>
              <p className="text-muted-foreground text-sm">≈ £{idea.cost} · £{idea.per_portion}/portion</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {idea.items.map((i) => (
                  <li key={i.uid} className="flex justify-between gap-2">
                    <a href={i.url} target="_blank" rel="noreferrer" className="hover:underline">{i.name}</a>
                    <span className="whitespace-nowrap">£{i.price?.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      {data && Object.entries(data.picks).map(([g, items]) => (
        <section key={g}>
          <h3 className="mb-2 font-medium capitalize">{g}</h3>
          <ItemsTable items={items} loading={false} />
        </section>
      ))}
      {loading && <ItemsTable loading />}
    </div>
  );
}
