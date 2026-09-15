"use client";
import { useRef, useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFavourites } from "@/lib/favourites";
import { useStore } from "@/lib/store-context";

const SUGGESTIONS = ["Best protein deals this week?", "Plan 4 lunches under £12 from today's offers", "Anything new worth trying?", "Cheapest way to do a veggie curry?"];
type Turn = { q: string; a: string; error?: string };

export function Ask() {
  const { code } = useStore();
  const { favs } = useFavourites();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true); setDraft("");
    setTurns((t) => [...t, { q, a: "" }]);
    const patch = (f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? f(t) : t)));
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, store: code, favourites: favs.slice(0, 20).map((f) => f.name) }) });
      if (!res.ok || !res.body) {
        const detail = await res.json().then((j) => j.detail).catch(() => res.statusText);
        patch((t) => ({ ...t, error: `${res.status}: ${detail}` }));
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        patch((t) => ({ ...t, a: t.a + chunk }));
        bottom.current?.scrollIntoView({ block: "end" });
      }
    } catch (e) {
      patch((t) => ({ ...t, error: String(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>)}
        </div>
      )}
      <div className="space-y-6">
        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <p className="font-serif text-xl leading-snug">{t.q}</p>
            {t.error ? (
              <p className="text-destructive text-sm">{t.error}{t.error.startsWith("503") && " — add ANTHROPIC_API_KEY / GEMINI_API_KEY and SAINS_MODEL to the environment."}</p>
            ) : t.a ? (
              <div className="md text-sm leading-relaxed"><Markdown>{t.a}</Markdown></div>
            ) : (
              <p className="text-muted-foreground text-sm">Checking offers… tool calls scrape live, this can take 10–40 s.</p>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="bg-background sticky bottom-0 flex gap-2 py-3" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about offers, new items, meal prep…" rows={2} className="min-h-0 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
        <Button type="submit" disabled={busy || !draft.trim()} className="self-end">{busy ? "…" : "Ask"}</Button>
      </form>
    </div>
  );
}
