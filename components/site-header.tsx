"use client";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NAV } from "@/lib/nav";

export function SiteHeader() {
  const path = usePathname();
  const page = NAV.find((n) => n.href === path) ?? NAV[0];
  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-12 items-center gap-2 border-b px-3 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <h1 className="font-serif text-lg leading-none ml-1">{page.title}</h1>
      <p className="text-muted-foreground hidden truncate text-sm sm:block">{page.blurb}</p>
    </header>
  );
}
