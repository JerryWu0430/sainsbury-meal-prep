"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false); // false on the server, true once hydrated
  const dark = mounted && resolvedTheme === "dark";
  return (
    // size-7 keeps the visual weight; the pseudo-element takes the hit area to 44px (WCAG 2.5.5)
    <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light" : "Switch to dark"} onClick={() => setTheme(dark ? "light" : "dark")}
      className="relative size-7 before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']">
      <span className="t-icon-swap size-4 place-items-center" data-state={dark ? "b" : "a"}>
        <Sun data-icon="a" strokeWidth={1.75} className="t-icon size-4" />
        <Moon data-icon="b" strokeWidth={1.75} className="t-icon size-4" />
      </span>
    </Button>
  );
}
