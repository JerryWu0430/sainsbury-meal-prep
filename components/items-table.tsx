"use client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Item } from "@/lib/api";

const gbp = (n: number | null) => (n == null ? "" : `£${n.toFixed(2)}`);

export function ItemsTable({ items, loading, error }: { items?: Item[]; loading: boolean; error?: string }) {
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (loading) return <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
  if (!items?.length) return <p className="text-muted-foreground text-sm">nothing found</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Deal</TableHead>
          <TableHead className="hidden md:table-cell">Ends</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.uid}>
            <TableCell className="max-w-[28rem] whitespace-normal">
              <a href={i.url} target="_blank" rel="noreferrer" className="hover:underline">{i.name}</a>
              <div className="text-muted-foreground text-xs">{i.unit}{i.life && ` · ${i.life}`}</div>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {gbp(i.price)}
              {i.was && <span className="text-muted-foreground ml-1 text-xs line-through">{gbp(i.was)}</span>}
            </TableCell>
            <TableCell className="whitespace-normal">
              {i.pct > 0 && <Badge className="mr-1 bg-green-600 text-white">-{i.pct}%</Badge>}
              {i.nectar && <Badge variant="secondary" className="mr-1">Nectar</Badge>}
              <span className="text-xs">{i.promo}</span>
            </TableCell>
            <TableCell className="text-muted-foreground hidden text-xs md:table-cell">{i.ends.slice(5)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
