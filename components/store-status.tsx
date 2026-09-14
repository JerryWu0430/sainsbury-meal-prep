"use client";
import { useApi, type Store } from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { StorePicker } from "./store-picker";

export function StoreStatus() {
  const { code } = useStore();
  const { data: s } = useApi<Store>(`/api/store?store=${code}`);
  if (!s) return <div className="text-muted-foreground px-2 text-xs">loading store…</div>;
  const open = s.open_now?.is_open;
  const today = s.hours[(new Date().getDay() + 6) % 7]; // hours[] is Mon-first, getDay() is Sun-first
  return (
    <div className="space-y-1 px-2 py-1 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium">{s.name}</span>
        <span className="ml-auto"><StorePicker /></span>
      </div>
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={`size-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-red-500"}`} />
        {open ? `Open until ${s.open_now?.open_until}` : "Closed"}
        <span className="text-muted-foreground">· today {today?.[1]}</span>
      </div>
      <div className="text-muted-foreground truncate" title={s.facilities.join(", ")}>{s.address}</div>
    </div>
  );
}
