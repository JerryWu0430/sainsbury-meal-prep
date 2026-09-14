"use client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Item } from "@/lib/api";

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
      {i.pct > 0 && <Badge className="bg-emerald-600 text-white dark:bg-emerald-500">-{i.pct}%</Badge>}
      {i.nectar && <Badge variant="secondary" className="bg-violet-500/10 text-violet-700 dark:text-violet-300">Nectar</Badge>}
      {i.promo && <span className="text-muted-foreground text-xs">{i.promo}</span>}
    </span>
  );
}

export function ItemsTable({ items, loading, error }: { items?: Item[]; loading: boolean; error?: string }) {
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
        {items.map((i) => (
          <TableRow key={i.uid}>
            <TableCell className="whitespace-normal">
              <div className="flex items-center gap-3">
                <Thumb src={i.thumb} />
                <div className="min-w-0">
                  <a href={i.url} target="_blank" rel="noreferrer" className="hover:underline">{i.name}</a>
                  <div className="text-muted-foreground text-xs">{i.unit}{i.life && ` · ${i.life}`}</div>
                  <div className="mt-1 sm:hidden"><Deal i={i} /></div>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right align-top whitespace-nowrap tabular-nums">
              <div>{gbp(i.price)}</div>
              {i.was && <div className="text-muted-foreground text-xs line-through">{gbp(i.was)}</div>}
            </TableCell>
            <TableCell className="hidden whitespace-normal sm:table-cell"><Deal i={i} /></TableCell>
            <TableCell className="text-muted-foreground hidden text-xs tabular-nums md:table-cell">{i.ends === today() ? <span className="text-amber-600 dark:text-amber-400">today</span> : i.ends.slice(5)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
