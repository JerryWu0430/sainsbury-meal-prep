"use client";
import { Badge } from "@/components/ui/badge";
import { useApi, type Store } from "@/lib/api";

export function StoreCard() {
  const { data: s } = useApi<Store>("/api/store");
  if (!s) return <div className="text-muted-foreground text-sm">loading store…</div>;
  const open = s.open_now?.is_open;
  const today = s.hours[(new Date().getDay() + 6) % 7]; // hours[] is Mon-first, getDay() is Sun-first
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{s.address}</span>
      <Badge variant={open ? "default" : "destructive"}>{open ? `open until ${s.open_now?.open_until}` : "closed"}</Badge>
      <span className="text-muted-foreground">today {today?.[1]}</span>
      <span title={s.facilities.join(", ")} className="text-muted-foreground cursor-help underline decoration-dotted">{s.facilities.length} facilities</span>
    </div>
  );
}
