import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authEnabled } from "@/lib/auth";
import { StoreProvider } from "@/lib/store-context";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <StoreProvider>
      <SidebarProvider>
        <AppSidebar auth={authEnabled()} />
        <SidebarInset>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </StoreProvider>
  );
}
