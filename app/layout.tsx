import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StoreProvider } from "@/lib/store-context";
import { ThemeProvider } from "next-themes";

const sans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Sainsbury's E&C", template: "%s · Sainsbury's E&C" },
  description: "Offers, new-in and meal-prep ideas for Sainsbury's Elephant & Castle",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* product thumbnails come from this origin on every list page */}
        <link rel="preconnect" href="https://assets.sainsburys-groceries.co.uk" />
      </head>
      <body className="min-h-full font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <StoreProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <SiteHeader />
              <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
