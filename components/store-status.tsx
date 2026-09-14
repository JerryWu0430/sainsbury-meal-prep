"use client";
import { useApi, type Store } from "@/lib/api";

export function StoreStatus() {
  const { data: s } = useApi<Store>("/api/store");
  if (!s) return <div className="text-muted-foreground px-2 text-xs">loading store…</div>;
  const open = s.open_now?.is_open;
  const today = s.hours[(new Date().getDay() + 6) % 7]; // hours[] is Mon-first, getDay() is Sun-first
  return (
    <div className="space-y-1 px-2 py-1 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <span aria-hidden className={`size-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-red-500"}`} />
        {open ? `Open until ${s.open_now?.open_until}` : "Closed"}
      </div>
      <div className="text-muted-foreground">Today {today?.[1]}</div>
      <div className="text-muted-foreground" title={s.facilities.join(", ")}>{s.address}</div>
    </div>
  );
}
