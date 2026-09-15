"use client";
import { Star } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Item } from "@/lib/api";
import { useFavourites } from "@/lib/favourites";

const gbp = (n: number | null) => (n == null ? "" : `£${n.toFixed(2)}`);
const today = () => new Date().toISOString().slice(0, 10);

export function Thumb({ src, size = 40 }: { src: string; size?: number }) {
  // product shots are white-background JPEGs; 1px low-alpha outline gives them an edge on any surface
  return (
    // eslint-disable-next-line @next/next/no-img-element -- hotlinked from Sainsbury's S3; next/image would proxy every thumb through Vercel for no gain at 40px
    <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async"
      className="shrink-0 rounded-md bg-white object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
      style={{ width: size, height: size }} />
  );
}

function Deal({ i }: { i: Item }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {i.pct > 0 && <Badge className="bg-emerald-700 text-white">-{i.pct}%</Badge>}
      {i.nectar && <Badge variant="secondary" className="bg-violet-500/10 text-violet-700 dark:text-violet-300">Nectar</Badge>}
      {i.promo && <span className="text-muted-foreground text-xs">{i.promo}</span>}
    </span>
  );
}

export function StarButton({ item }: { item: Item }) {
  const { has, toggle } = useFavourites();
  const on = has(item.uid);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Remove from favourites" : "Add to favourites"} onClick={() => toggle(item)}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative -m-1 grid size-8 shrink-0 place-items-center rounded-md transition-[color,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)] outline-none focus-visible:ring-3 active:scale-[0.96] motion-reduce:active:scale-100 before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']">
      <Star strokeWidth={1.75} className={`size-4 transition-[fill,color] duration-150 ${on ? "fill-amber-400 text-amber-600 dark:text-amber-400" : "fill-transparent"}`} />
    </button>
  );
}

const FORM: Record<string, string> = { ready: "ready-made", frozen: "frozen" };

export function ItemsTable({ items, loading, error, groupBy }: { items?: Item[]; loading: boolean; error?: string; groupBy?: (i: Item) => string }) {
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (loading) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!items?.length) return <p className="text-muted-foreground text-sm">Nothing found.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="hidden sm:table-cell">Deal</TableHead>
          <TableHead className="hidden md:table-cell">Ends</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i, n) => (
          <Fragment key={i.uid}>
          {groupBy && (n === 0 || groupBy(items[n - 1]) !== groupBy(i)) && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="bg-muted/40 py-1.5 font-serif text-base">{groupBy(i)}</TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell className="whitespace-normal">
              <div className="flex items-center gap-3">
                <StarButton item={i} />
                <Thumb src={i.thumb} />
                <div className="min-w-0">
                  <a href={i.url} target="_blank" rel="noreferrer" className="hover:underline">{i.name}</a>
                  <div className="text-muted-foreground text-xs">{i.unit}{i.life && ` · ${i.life}`}{i.subcategory && ` · ${i.subcategory}`}{i.form && FORM[i.form] && <span className="ml-1 rounded bg-muted px-1 py-px text-[10px] uppercase tracking-wide">{FORM[i.form]}</span>}</div>
                  <div className="mt-1 sm:hidden"><Deal i={i} /></div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right align-top whitespace-nowrap tabular-nums">
              <div>{gbp(i.price)}</div>
              {i.was && <div className="text-muted-foreground text-xs line-through">{gbp(i.was)}</div>}
            </TableCell>
            <TableCell className="hidden whitespace-normal sm:table-cell"><Deal i={i} /></TableCell>
            <TableCell className="text-muted-foreground hidden text-xs tabular-nums md:table-cell">{i.ends === today() ? <span className="text-amber-700 dark:text-amber-400">today</span> : i.ends.slice(5)}</TableCell>
          </TableRow>
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
