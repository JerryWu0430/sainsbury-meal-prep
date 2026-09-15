"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsTable } from "@/components/items-table";
import { fetchJson, type Item } from "@/lib/api";
import { NEW_KWS, STAPLES } from "@/lib/keywords";

type Path = "offers" | "new" | "search";
type Nectar = "all" | "nectar" | "none";
type Sort = "pct" | "price" | "unit" | "category" | "order";
type Form = "all" | "ingredient" | "ready" | "frozen";
type Props = { path: Path; placeholder: string; hasMin?: boolean; required?: boolean };

const PAGE = 20;
const DEFAULTS: Record<Path, string[]> = { offers: STAPLES, new: NEW_KWS, search: [] };
const NECTAR: [Nectar, string][] = [["all", "All deals"], ["nectar", "Nectar"], ["none", "No card"]];
const SORTS: [Sort, string][] = [["pct", "% off"], ["price", "Price"], ["unit", "£/unit"], ["category", "Category"], ["order", "Relevance"]];
const cat = (i: Item) => i.category || "Other";
const FORMS: [Form, string][] = [["all", "Everything"], ["ingredient", "Ingredients"], ["ready", "Ready-made"], ["frozen", "Frozen"]];

// "£12.5/kg" -> 12.5 ; "£1.2/100g" -> 12 ; per-each isn't comparable -> last
const unitVal = (u: string) => {
  const m = u.match(/£([\d.]+)\/(kg|l|litre|100g|100ml)/i);
  return m ? +m[1] * (m[2].startsWith("100") ? 10 : 1) : Infinity;
};

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="group" aria-label={label} className="bg-muted flex rounded-lg p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`rounded-md px-2 py-1 text-xs transition-[color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${value === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Listing({ path, placeholder, hasMin = false, required = false }: Props) {
  const [draft, setDraft] = useState("");
  const [kws, setKws] = useState<string[]>(DEFAULTS[path]);
  const [min, setMin] = useState(0);
  const [nectar, setNectar] = useState<Nectar>("all");
  const [sort, setSort] = useState<Sort>(path === "offers" ? "pct" : "order");
  const [offersOnly, setOffersOnly] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [formFilter, setFormFilter] = useState<Form>("all");
  const offers = path === "offers" || (path === "search" && offersOnly);
  const isNew = path === "new";
  // everything fetched is keyed by the request, so a new request shows fresh state without resetting in an effect
  const key = JSON.stringify([kws, offers, isNew]);
  type Res = { key: string; items: Item[]; done: number; total: number; current: string; error?: string };
  const [res, setRes] = useState<Res>();
  const [shownFor, setShownFor] = useState({ key: "", n: PAGE });
  const cur: Res = res?.key === key ? res : { key, items: [], done: 0, total: kws.length, current: kws[0] ?? "" };
  const { items, error } = cur;
  const progress = cur;
  const shown = shownFor.key === key ? shownFor.n : PAGE;
  const setShown = (f: (n: number) => number) => setShownFor((s) => ({ key, n: f(s.key === key ? s.n : PAGE) }));
  const sentinel = useRef<HTMLDivElement>(null);

  // one request per keyword so every URL is CDN-cached and rows appear as each lands.
  // concurrency 2: warm loads finish in a few round-trips, cold loads put ≤2 scrapes in flight at Sainsbury's.
  useEffect(() => {
    const [kws, offers, isNew] = JSON.parse(key) as [string[], boolean, boolean];
    if (kws.length === 0) return;
    const ctrl = new AbortController();
    const seen = new Set<string>();
    const acc: Item[] = [];
    let done = 0, next = 0, error: string | undefined;
    const publish = () => setRes({ key, items: [...acc], done, total: kws.length, current: kws[next] ?? "", error });
    const worker = async () => {
      while (next < kws.length && !ctrl.signal.aborted) {
        const k = kws[next++];
        try {
          const batch = await fetchJson<Item[]>(`/api/search?q=${encodeURIComponent(k)}&offers=${offers}&new=${isNew}`, ctrl.signal);
          for (const it of batch) if (!seen.has(it.uid) && it.price && it.available) { seen.add(it.uid); acc.push(it); }
        } catch (e) {
          if (ctrl.signal.aborted) return;
          error = String((e as Error).message ?? e);
        }
        done++;
        publish();
      }
    };
    Promise.all([worker(), worker()]);
    return () => ctrl.abort();
  }, [key]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(cat(i), (m.get(cat(i)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const visible = useMemo(() => {
    const v = items.filter((i) => i.pct >= min && (nectar === "all" || (nectar === "nectar") === i.nectar) && (!catFilter || cat(i) === catFilter)
      && (formFilter === "all" || (i.form ?? "ingredient") === formFilter));
    const byDeal = (a: Item, b: Item) => b.pct - a.pct || (a.price ?? 0) - (b.price ?? 0);
    if (sort === "pct") v.sort(byDeal);
    else if (sort === "price") v.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === "unit") v.sort((a, b) => unitVal(a.unit) - unitVal(b.unit));
    else if (sort === "category") v.sort((a, b) => cat(a).localeCompare(cat(b)) || (a.subcategory ?? "").localeCompare(b.subcategory ?? "") || byDeal(a, b));
    return v;
  }, [items, min, nectar, sort, catFilter, formFilter]);

  useEffect(() => { // infinite scroll: reveal the next page when the sentinel nears the viewport
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) setShownFor((s) => ({ key, n: (s.key === key ? s.n : PAGE) + PAGE }));
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible.length, shown, key]);

  const loading = kws.length > 0 && progress.done < progress.total;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = draft.split(",").map((s) => s.trim()).filter(Boolean);
    setKws(typed.length ? typed : DEFAULTS[path]);
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={submit}>
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

      {(items.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-2">
          <Seg label="Nectar" value={nectar} onChange={setNectar} options={NECTAR} />
          <Seg label="Sort" value={sort} onChange={setSort} options={SORTS} />
          <Seg label="Form" value={formFilter} onChange={setFormFilter} options={FORMS} />
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {loading ? `Loading ${progress.current}… ${progress.done}/${progress.total}` : `${visible.length} items`}
          </span>
        </div>
      )}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
          {[["", `All (${items.length})`] as [string, string], ...categories.map(([c, n]) => [c, `${c} (${n})`] as [string, string])].map(([c, l]) => (
            <button key={c} type="button" aria-pressed={catFilter === c} onClick={() => setCatFilter(c)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${catFilter === c ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="bg-muted h-0.5 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-foreground h-full transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      )}
      {required && kws.length === 0 ? <p className="text-muted-foreground text-xs">Type to search.</p>
        : <ItemsTable items={visible.slice(0, shown)} loading={loading && items.length === 0} error={error} groupBy={sort === "category" ? cat : undefined} />}
      {nectar === "none" && !loading && visible.length < 5 && items.length > 0 && (
        <p className="text-muted-foreground text-xs">Almost all Sainsbury&apos;s online promotions are Nectar Prices now — card-free deals are mostly meal deals and multibuys. Try sort by £/unit for cheap without a card.</p>
      )}
      {shown < visible.length && (
        <div ref={sentinel} className="py-2 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>Show more ({visible.length - shown})</Button>
        </div>
      )}
    </div>
  );
}
