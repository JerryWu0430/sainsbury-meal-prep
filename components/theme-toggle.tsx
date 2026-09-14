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
    <Button variant="ghost" size="icon" className="size-7" aria-label={dark ? "Switch to light" : "Switch to dark"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {/* both icons stay in the DOM and cross-fade: opacity + scale + blur, no layout */}
      <span className="relative grid size-4 place-items-center">
        <Sun strokeWidth={1.75} className={`absolute size-4 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${dark ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"}`} />
        <Moon strokeWidth={1.75} className={`absolute size-4 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${dark ? "scale-100 opacity-100 blur-0" : "scale-25 opacity-0 blur-[4px]"}`} />
      </span>
    </Button>
  );
}
