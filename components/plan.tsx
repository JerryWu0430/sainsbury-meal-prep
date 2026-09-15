"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Thumb } from "@/components/items-table";
import { BANK, CUISINES, DEFAULT_GOALS, KEYWORDS, MACROS, costDish, planTotals, type Costed, type Goals, type Macro } from "@/lib/dishes";
import { createLocalStore } from "@/lib/local-store";
import { useCatalogue } from "@/lib/use-catalogue";
import { AvatarGroup, Digits, SuccessCheck, TextSwap } from "@/lib/transitions";

const goalsStore = createLocalStore<Goals>("sains_goals", DEFAULT_GOALS);
const planStore = createLocalStore<Record<string, number>>("sains_plan", {});
const LABEL: Record<Macro, string> = { kcal: "kcal", protein: "protein", carbs: "carbs", fat: "fat" };
const UNIT: Record<Macro, string> = { kcal: "", protein: "g", carbs: "g", fat: "g" };
type Sort = "perPortion" | "protein" | "offers";

function Bar({ value, goal, k }: { value: number; goal: number; k: Macro }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0; const over = goal && value > goal * 1.1;
  return (
    <div className="min-w-0 flex-1" title={`${LABEL[k]} ${value}${UNIT[k]} of ${goal}${UNIT[k]} goal${over ? " — over" : ""}`}>
      <div className="flex justify-between text-[11px] leading-none"><span className="text-muted-foreground">{LABEL[k]}</span><span className="tabular-nums">{value}{UNIT[k]}{over ? <span className="text-amber-700 dark:text-amber-400" title="over goal"> ↑</span> : null}</span></div>
      <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full"><div className={`h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${over ? "bg-amber-600" : "bg-foreground"}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Stepper({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="relative size-8 p-0 before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" aria-label="Fewer batches" onClick={() => onChange(Math.max(0, n - 1))} disabled={n === 0}>−</Button>
      <span className="w-14 text-center text-sm tabular-nums"><TextSwap>{n ? `${n}× · ${n * 4} pt` : "Add"}</TextSwap></span>
      <Button size="sm" variant={n ? "outline" : "default"} className="relative size-8 p-0 before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" aria-label="More batches" onClick={() => onChange(n + 1)}>+</Button>
    </div>
  );
}

export function Plan() {
  const [goals, setGoals] = goalsStore.use();
  const [sel, setSel] = planStore.use();
  const [cuisine, setCuisine] = useState("");
  const [sort, setSort] = useState<Sort>("perPortion");
  const cat = useCatalogue(KEYWORDS);

  const dishes = useMemo(() => {
    const all = BANK.dishes.filter((d) => !cuisine || d.cuisine === cuisine).map((d) => costDish(d, cat.map));
    const key: Record<Sort, (d: Costed) => number> = { perPortion: (d) => d.perPortion || 1e9, protein: (d) => -d.proteinPerPound, offers: (d) => -d.onOffer / d.ingredients.length };
    return all.sort((a, b) => Number(a.missing.length > 0) - Number(b.missing.length > 0) || key[sort](a) - key[sort](b));
  }, [cat.map, cuisine, sort]);

  // React Compiler memoizes these; manual useMemo here trips preserve-manual-memoization
  const selected = Object.entries(sel).filter(([, n]) => n > 0).map(([id, batches]) => ({ dish: dishes.find((d) => d.id === id) ?? costDish(BANK.dishes.find((d) => d.id === id)!, cat.map), batches }));
  const totals = planTotals(selected);
  const setBatches = (id: string, n: number) => setSel({ ...sel, [id]: n });
  const ready = !cat.loading;

  const [copied, setCopied] = useState(0);
  const copyList = () => {
    const txt = [`Sainsbury's shopping list — ${totals.portions} portions, ≈ £${totals.packsCost}`, ...totals.shopping.map((r) => `${r.packs}× ${r.product.name} — £${(r.packs * (r.product.price ?? 0)).toFixed(2)}${r.product.pct ? ` (${r.product.pct}% off)` : ""} ${r.product.url}`),
      "", ...selected.map((s) => `${s.batches}× ${s.dish.name}`)].join("\n");
    navigator.clipboard?.writeText(txt);
    setCopied((n) => n + 1);
  };
  const askQ = `Plan my meal prep: ${selected.map((s) => `${s.batches}× ${s.dish.name}`).join(", ") || "suggest 3 dishes"}. Goals per portion: ${goals.kcal} kcal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat. Check today's offers and swap ingredients for better deals.`;

  return (
    <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Sort" className="bg-muted flex rounded-lg p-0.5">
            {([["perPortion", "£/portion"], ["protein", "Protein per £"], ["offers", "On offer"]] as [Sort, string][]).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => setSort(v)} className={`focus-visible:ring-ring/50 relative rounded-md px-2.5 py-1.5 text-xs transition-[color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none focus-visible:ring-3 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${sort === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
          </div>
          <span role="status" aria-live="polite" className="text-muted-foreground ml-auto text-xs tabular-nums">
            <TextSwap>{cat.loading ? `Pricing ${cat.current}… ${cat.done}/${cat.total}` : `${dishes.length} dishes · prices live`}</TextSwap>
          </span>
        </div>
        {cat.loading && <div className="bg-muted h-0.5 overflow-hidden rounded-full" aria-hidden><div className="bg-foreground h-full transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]" style={{ width: `${(cat.done / Math.max(1, cat.total)) * 100}%` }} /></div>}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cuisine">
          {["", ...CUISINES].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cuisine === c} onClick={() => setCuisine(c)} className={`focus-visible:ring-ring/50 min-h-7 rounded-full border px-3 py-1 text-xs transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none focus-visible:ring-3 ${cuisine === c ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground"}`}>{c || "All cuisines"}</button>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={(e) => e.preventDefault()}>
          <span className="text-muted-foreground">Goals per portion</span>
          {MACROS.map((k) => (
            <label key={k} className="flex items-center gap-1">{LABEL[k]}<Input type="number" className="h-7 w-16 tabular-nums" value={goals[k]} min={0} onChange={(e) => setGoals({ ...goals, [k]: +e.target.value })} aria-label={`${LABEL[k]} goal per portion`} />{UNIT[k]}</label>
          ))}
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          {!ready && dishes.every((d) => d.lines.length === 0) && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
          {dishes.map((d) => (
            <Card key={d.id} className={sel[d.id] ? "ring-foreground/20 ring-1" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-serif text-lg leading-snug font-normal">{d.name}</CardTitle>
                    <p className="text-muted-foreground text-xs">{d.cuisine}{d.tags.length ? ` · ${d.tags.join(", ")}` : ""} · {d.portions} portions</p>
                  </div>
                  <div className="text-right"><div className="text-lg tabular-nums">{d.lines.length ? <>£<Digits value={d.perPortion.toFixed(2)} /></> : "—"}</div><div className="text-muted-foreground text-[11px]">per portion</div></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">{MACROS.map((k) => <Bar key={k} k={k} value={d.macros[k]} goal={goals[k]} />)}</div>
                <div className="flex items-center gap-2">
                  <AvatarGroup className="flex -space-x-2">{d.lines.slice(0, 7).map((l) => <Thumb key={l.product.uid} src={l.product.thumb} size={28} />)}</AvatarGroup>
                  <span className="text-muted-foreground text-xs">{d.onOffer}/{d.ingredients.length} on offer{d.missing.length ? ` · not priced: ${d.missing.join(", ")}` : ""}</span>
                </div>
                <details className="text-xs"><summary className="text-muted-foreground focus-visible:ring-ring/50 cursor-pointer rounded outline-none focus-visible:ring-3">Ingredients & method</summary>
                  <ul className="mt-2 space-y-0.5">{d.lines.map((l) => <li key={l.ref} className="flex justify-between gap-2"><span className="truncate">{l.grams}g {l.ref} → <a href={l.product.url} target="_blank" rel="noreferrer" className="hover:underline">{l.product.name}</a></span><span className="tabular-nums">£{l.cost.toFixed(2)}{l.product.pct ? <Badge className="ml-1 bg-emerald-700 px-1 py-0 text-[10px] text-white">-{l.product.pct}%</Badge> : null}</span></li>)}</ul>
                  <p className="text-muted-foreground mt-2">{d.method}</p>
                </details>
                <Stepper n={sel[d.id] ?? 0} onChange={(n) => setBatches(d.id, n)} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <aside className="mt-6 space-y-4 lg:sticky lg:top-16 lg:mt-0 lg:self-start">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="font-serif text-lg font-normal">Your plan</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selected.length === 0 ? <p className="text-muted-foreground text-xs">Add dishes with +. Totals, macros vs goals and a merged shopping list appear here.</p> : (
              <>
                <ul className="space-y-1">{selected.map((s) => <li key={s.dish.id} className="flex justify-between gap-2"><span className="truncate">{s.batches}× {s.dish.name}</span><span className="tabular-nums">£{(s.dish.cost * s.batches).toFixed(2)}</span></li>)}</ul>
                <div className="flex items-baseline justify-between border-t pt-2"><span><Digits value={totals.portions} /> portions</span><span className="text-lg tabular-nums">£<Digits value={totals.cost.toFixed(2)} /></span></div>
                <p className="text-muted-foreground text-xs tabular-nums">≈ £{totals.perPortion.toFixed(2)}/portion · whole packs ≈ £{totals.packsCost.toFixed(2)}{totals.pantryCost > 0 && ` + £${totals.pantryCost.toFixed(2)} pantry (spices, oil, sauces you may have)`}</p>
                <div className="flex gap-3">{MACROS.map((k) => <Bar key={k} k={k} value={totals.macrosPerPortion[k]} goal={goals[k]} />)}</div>
                <div className="border-t pt-2">
                  <div className="mb-1 flex items-center justify-between"><span className="font-medium">Shopping list</span><span className="flex items-center gap-1.5"><SuccessCheck token={copied} className="text-emerald-700 dark:text-emerald-400" /><span role="status" aria-live="polite" className="sr-only">{copied ? "Shopping list copied" : ""}</span><Button size="sm" variant="outline" onClick={copyList}>Copy</Button></span></div>
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto">{totals.shopping.map((r) => (
                    <li key={r.product.uid} className="flex items-center gap-2 text-xs">
                      <Thumb src={r.product.thumb} size={24} />
                      <span className="min-w-0 flex-1"><a href={r.product.url} target="_blank" rel="noreferrer" className="block truncate hover:underline">{r.packs}× {r.product.name}</a><span className="text-muted-foreground block truncate">{r.pantry ? "pantry · " : ""}{r.for.join(", ")}</span></span>
                      <span className="tabular-nums">£{(r.packs * (r.product.price ?? 0)).toFixed(2)}</span>{r.product.pct ? <Badge className="bg-emerald-700 px-1 py-0 text-[10px] text-white">-{r.product.pct}%</Badge> : null}
                    </li>))}</ul>
                </div>
                <Link href={`/ask?q=${encodeURIComponent(askQ)}`} className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>Ask the agent to refine this plan</Link>
              </>
            )}
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-[11px]">Macros are estimates from standard per-100 g values of raw ingredients; prices are today&apos;s online prices, proportional by weight where the unit price is known.</p>
      </aside>
    </div>
  );
}
