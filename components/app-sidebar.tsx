"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import { NAV } from "@/lib/nav";
import { StoreStatus } from "./store-status";

export function AppSidebar() {
  const path = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-3">
        <Link href="/" className="font-serif text-xl leading-none tracking-tight group-data-[collapsible=icon]:hidden">
          Sainsbury&apos;s <span className="text-muted-foreground">E&amp;C</span>
        </Link>
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
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <StoreStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
