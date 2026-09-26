"use client";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import { useFavourites } from "@/lib/favourites";
import { NAV } from "@/lib/nav";
import { Digits } from "@/lib/transitions";
import { StoreStatus } from "./store-status";
import { ThemeToggle } from "./theme-toggle";

export function AppSidebar({ auth }: { auth: boolean }) {
  const path = usePathname();
  const { favs } = useFavourites();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between px-3 pt-3">
        <Link href="/" className="font-serif text-xl leading-none tracking-tight group-data-[collapsible=icon]:hidden">
          Sainsbury&apos;s <span className="text-muted-foreground">E&amp;C</span>
        </Link>
        <span className="group-data-[collapsible=icon]:hidden"><ThemeToggle /></span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map(({ href, title, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton render={<Link href={href} />} isActive={path === href} tooltip={title}>
                  <Icon strokeWidth={1.75} />
                  <span>{title}</span>
                </SidebarMenuButton>
                {href === "/favourites" && (
                  // stays mounted so the badge can animate both ways; the count itself pops per change
                  <span className="t-badge group-data-[collapsible=icon]:hidden" data-anchor="row" data-open={favs.length > 0}>
                    <span className="t-badge-dot text-sidebar-foreground flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none">
                      <Digits value={favs.length || ""} />
                    </span>
                    <span className="sr-only">{favs.length} saved</span>
                  </span>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <StoreStatus />
        {auth && (
          <form action={logout}>
            <SidebarMenuButton type="submit" size="sm" className="text-muted-foreground"><LogOut strokeWidth={1.75} /><span>Log out</span></SidebarMenuButton>
          </form>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
