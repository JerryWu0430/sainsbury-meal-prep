"use client";
// transitions.dev orchestration. The CSS lives in app/globals.css; this file
// only drives the documented class/attribute hooks and reads its timings back
// out of the :root variables so the two can never drift.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

const cssVar = (name: string) => (typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim());
const cssMs = (name: string, fallback: number) => {
  const v = parseFloat(cssVar(name));
  return Number.isFinite(v) ? v : fallback;
};

/** Text states swap — old text exits up with blur, new text enters from below. */
export function TextSwap({ children, className = "" }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(children);
  const next = useRef(children);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    next.current = children; // a swap already in flight commits the newest value
    const el = ref.current;
    if (!el || children === shown || timer.current) return;
    el.classList.add("is-exit");
    timer.current = setTimeout(() => {
      timer.current = undefined;
      flushSync(() => setShown(next.current)); // paint the new text before the reflow
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      void el.offsetHeight; // force reflow so removing the class transitions
      el.classList.remove("is-enter-start");
    }, cssMs("--text-swap-dur", 150));
  }, [children, shown]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return <span ref={ref} className={`t-text-swap ${className}`}>{shown}</span>;
}

/** Number pop-in — each character re-enters with a blurred slide; last two stagger. */
export function Digits({ value, className = "" }: { value: string | number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const str = String(value);
  const chars = [...str];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-animating");
    void el.offsetHeight; // force reflow so the keyframes restart
    el.classList.add("is-animating");
  }, [str]);
  return (
    <span ref={ref} className={`t-digit-group is-animating ${className}`}>
      {chars.map((ch, i) => (
        <span key={i} className="t-digit" data-stagger={i === chars.length - 2 ? 1 : i === chars.length - 1 ? 2 : undefined}>{ch}</span>
      ))}
    </span>
  );
}

/** Success check — fade + rotate + Y-bob + stroke draw. Replays whenever `token` changes. */
export function SuccessCheck({ token, className = "" }: { token?: string | number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !token) return;
    el.setAttribute("data-state", "out");
    void el.offsetWidth; // force reflow so keyframes restart
    el.setAttribute("data-state", "in");
  }, [token]);
  return (
    <span ref={ref} data-state="out" aria-hidden className={`t-success-check ${className}`}>
      {/* 19.80 user units long — matches the stroke-dasharray: 20 in globals.css */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="size-4">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

/** Avatar group hover — distance-falloff lift, bouncy spring on return. */
export function AvatarGroup({ children, className = "" }: { children: ReactNode[]; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  // the timing-function has to be set inline *before* the variable writes: the
  // browser uses whichever curve is current when the property changes, which is
  // what gives ease-in going up and an overshoot spring coming back.
  const setShifts = (activeIdx: number | null, phase: "in" | "out") => {
    if (!root.current) return;
    const lift = cssMs("--avatar-lift", -4);
    const falloff = cssMs("--avatar-falloff", 0.45);
    const scale = cssMs("--avatar-scale", 1.05);
    const tf = phase === "out"
      ? cssVar("--avatar-ease-out") || "cubic-bezier(0.34, 3.85, 0.64, 1)"
      : cssVar("--avatar-ease-in") || "cubic-bezier(0.22, 1, 0.36, 1)";

    root.current.querySelectorAll<HTMLElement>(".t-avatar").forEach((el, i) => {
      el.style.transitionTimingFunction = tf;
      if (activeIdx == null) {
        el.style.setProperty("--shift", "0px");
        el.style.setProperty("--scale-active", "1");
        return;
      }
      const d = Math.abs(i - activeIdx);
      el.style.setProperty("--shift", (lift * Math.pow(falloff, d)).toFixed(3) + "px");
      el.style.setProperty("--scale-active", i === activeIdx ? String(scale) : "1");
    });
  };

  return (
    <div ref={root} className={className} onMouseLeave={() => setShifts(null, "out")}>
      {children.map((node, i) => (
        <div key={i} className="t-avatar" onMouseEnter={() => setShifts(i, "in")}>{node}</div>
      ))}
    </div>
  );
}

/**
 * Error state shake — put the returned ref on the `.t-input-wrap`, `t-input` on
 * whatever owns the border and `t-error-msg` on the message. Pass a token that
 * changes per failure; `clear` cancels the auto-revert when the user starts fixing it.
 */
export function useErrorShake(token: string | undefined) {
  const wrap = useRef<HTMLDivElement>(null);
  const revert = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clear = () => {
    clearTimeout(revert.current);
    revert.current = undefined;
    wrap.current?.classList.remove("is-error");
    wrap.current?.querySelector(".t-input")?.classList.remove("is-error");
  };

  useEffect(() => {
    const el = wrap.current;
    const input = el?.querySelector<HTMLElement>(".t-input");
    if (!token || !el || !input) return;
    el.classList.add("is-error");
    input.classList.add("is-error");

    input.classList.remove("is-shaking");
    void input.offsetWidth; // force reflow so the shake replays
    input.classList.add("is-shaking");

    const shakeMs = cssMs("--shake-dur-a", 80) * 2 + cssMs("--shake-dur-b", 60) * 2;
    const stop = setTimeout(() => input.classList.remove("is-shaking"), shakeMs + 20);
    clearTimeout(revert.current);
    revert.current = setTimeout(() => {
      el.classList.remove("is-error");
      input.classList.remove("is-error");
    }, shakeMs + cssMs("--revert-hold", 3000));
    return () => { clearTimeout(stop); clearTimeout(revert.current); };
  }, [token]);

  return { wrap, clear };
}
