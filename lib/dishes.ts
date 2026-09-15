import bank from "@/data/dishes.json";
import type { Item } from "./api";

export type Macro = "kcal" | "protein" | "carbs" | "fat";
export const MACROS: Macro[] = ["kcal", "protein", "carbs", "fat"];
export type Spec = { kw: string; role: string; must: string[]; avoid: string[]; any?: boolean; form?: string; per100: number[] };
export type Dish = { id: string; name: string; cuisine: string; portions: number; tags: string[]; ingredients: [string, number][]; method: string };
export type Line = { ref: string; grams: number; product: Item; cost: number; proportional: boolean };
export type Costed = Dish & { lines: Line[]; missing: string[]; cost: number; perPortion: number; macros: Record<Macro, number>; proteinPerPound: number; onOffer: number };
export type Goals = Record<Macro, number>;

export const BANK = bank as unknown as { ingredients: Record<string, Spec>; dishes: Dish[] };
export const KEYWORDS = [...new Set(Object.values(BANK.ingredients).map((s) => s.kw))];
export const CUISINES = [...new Set(BANK.dishes.map((d) => d.cuisine))].sort();
export const DEFAULT_GOALS: Goals = { kcal: 600, protein: 40, carbs: 60, fat: 20 }; // per portion

const unitPerG = (u: string) => { const m = (u || "").match(/£([\d.]+)\/(kg|l|litre|100g|100ml)/); return m ? +m[1] / (m[2].startsWith("100") ? 100 : 1000) : null; };
const tokensOk = (name: string, s: Spec) => {
  const n = name.toLowerCase(); const has = s.must.map((t) => n.includes(t));
  if (s.must.length && !(s.any ? has.some(Boolean) : has.every(Boolean))) return false;
  return !s.avoid.some((t) => n.includes(t));
};

export function pick(spec: Spec, candidates: Item[], grams: number): Omit<Line, "ref" | "grams"> | null {
  const want = spec.form ?? "ingredient";
  const ok = candidates.filter((c) => c.available && c.price && [want, "ingredient"].includes(c.form ?? "ingredient") && tokensOk(c.name, spec));
  if (!ok.length) return null;
  const cost = (c: Item) => { const g = unitPerG(c.unit); return g ? g * grams : c.price!; };
  const packG = (c: Item) => { const g = unitPerG(c.unit); return g ? c.price! / g : null; };
  // prefer sensibly sized packs (≤ 5× what the dish needs) so 300 g of rice doesn't resolve to a 10 kg sack
  const fit = ok.filter((c) => { const pg = packG(c); return pg === null || pg <= Math.max(5 * grams, 1000); });
  const best = (fit.length ? fit : ok).reduce((a, b) => (Math.round(cost(b) * 100) < Math.round(cost(a) * 100) || (Math.round(cost(b) * 100) === Math.round(cost(a) * 100) && b.pct > a.pct) ? b : a));
  return { product: best, cost: Math.round(cost(best) * 100) / 100, proportional: unitPerG(best.unit) !== null };
}

/** catalogue: ingredient keyword → products from its search */
export function costDish(d: Dish, catalogue: Map<string, Item[]>): Costed {
  const lines: Line[] = []; const missing: string[] = []; let cost = 0;
  const macros: Record<Macro, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const [ref, grams] of d.ingredients) {
    const spec = BANK.ingredients[ref];
    MACROS.forEach((k, i) => (macros[k] += (spec.per100[i] * grams) / 100));
    const m = pick(spec, catalogue.get(spec.kw) ?? [], grams);
    if (m) { cost += m.cost; lines.push({ ref, grams, ...m }); } else missing.push(ref);
  }
  const per = Object.fromEntries(MACROS.map((k) => [k, Math.round((macros[k] / d.portions) * 10) / 10])) as Record<Macro, number>;
  return { ...d, lines, missing, cost: Math.round(cost * 100) / 100, perPortion: Math.round((cost / d.portions) * 100) / 100, macros: per,
    proteinPerPound: cost ? Math.round(((per.protein * d.portions) / cost) * 10) / 10 : 0, onOffer: lines.filter((l) => l.product.pct > 0).length };
}

export type ShopRow = { product: Item; grams: number; cost: number; packs: number; for: string[]; pantry: boolean };
export function planTotals(selected: { dish: Costed; batches: number }[]) {
  const shop = new Map<string, ShopRow>(); let portions = 0, cost = 0;
  const macros: Record<Macro, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { dish, batches } of selected) {
    portions += dish.portions * batches; cost += dish.cost * batches;
    MACROS.forEach((k) => (macros[k] += dish.macros[k] * dish.portions * batches));
    for (const l of dish.lines) {
      const row = shop.get(l.product.uid) ?? { product: l.product, grams: 0, cost: 0, packs: 1, for: [], pantry: false };
      row.grams += l.grams * batches; row.cost += l.cost * batches; if (!row.for.includes(dish.name)) row.for.push(dish.name);
      shop.set(l.product.uid, row);
    }
  }
  for (const row of shop.values()) {
    row.packs = row.product.price ? Math.max(1, Math.ceil(row.cost / row.product.price - 1e-9)) : 1;
    // long-life pantry staple: a sauce/oil/spice where the plan uses under a third of one pack — you probably have it
    const role = BANK.ingredients[Object.keys(BANK.ingredients).find((k) => BANK.ingredients[k].kw && selected.some((s) => s.dish.lines.some((l) => l.product.uid === row.product.uid && l.ref === k))) ?? ""]?.role;
    row.pantry = ["sauce", "other"].includes(role ?? "") && row.product.price ? row.cost / row.product.price < 0.34 : false;
  }
  const rows = [...shop.values()];
  const packsCost = rows.filter((r) => !r.pantry).reduce((s, r) => s + r.packs * (r.product.price ?? 0), 0);
  const pantryCost = rows.filter((r) => r.pantry).reduce((s, r) => s + r.packs * (r.product.price ?? 0), 0);
  return { portions, cost: Math.round(cost * 100) / 100, packsCost: Math.round(packsCost * 100) / 100, pantryCost: Math.round(pantryCost * 100) / 100,
    perPortion: portions ? Math.round((cost / portions) * 100) / 100 : 0,
    macrosPerPortion: Object.fromEntries(MACROS.map((k) => [k, portions ? Math.round((macros[k] / portions) * 10) / 10 : 0])) as Record<Macro, number>,
    shopping: [...shop.values()].sort((a, b) => b.cost - a.cost) };
}
