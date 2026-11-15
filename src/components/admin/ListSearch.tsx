/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SearchKind = "games" | "tracks";
type Hit = { key: string; title: string; sub: string; image: string; item: any };
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

async function searchGames(q: string): Promise<Hit[]> {
  const r = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(q)}&limit=12`);
  const list: any[] = await r.json();
  return list.map((g) => {
    const cover = g.steamAppID ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.steamAppID}/library_600x900_2x.jpg` : g.thumb;
    return {
      key: g.gameID,
      title: g.external,
      sub: g.steamAppID ? "PC · Steam" : "PC",
      image: cover,
      item: { id: uid("gm"), title: g.external, platform: "PC", status: "Backlog", hours: 0, rating: 7, review: "", favorite: false, image: cover },
    };
  });
}

// Audius: free, keyless, full-length streams.
const AUDIUS = "https://api.audius.co/v1";
const APP = "app_name=naphium-portfolio";
async function searchTracks(q: string): Promise<Hit[]> {
  const r = await fetch(`${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=15&${APP}`);
  const { data = [] } = await r.json();
  return data.filter((t: any) => t.is_streamable !== false).map((t: any) => ({
    key: String(t.id),
    title: t.title,
    sub: `${t.user?.name ?? ""} · ${Math.round((t.duration ?? 0) / 60)} min · full track`,
    image: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? "",
    item: { id: uid("trk"), title: t.title, artist: t.user?.name ?? "", url: `${AUDIUS}/tracks/${t.id}/stream?${APP}`, notes: [261.63, 329.63, 392], bpm: 120, wave: "square" },
  }));
}

export function ListSearch({ kind, onAdd }: { kind: SearchKind; onAdd: (item: any) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [pick, setPick] = useState<Hit | null>(null);
  const [hours, setHours] = useState("0");
  const [review, setReview] = useState("");
  const run = async (term = q) => {
    if (!term.trim()) return setHits([]);
    setBusy(true);
    try {
      setHits(await (kind === "games" ? searchGames(term) : searchTracks(term)));
    } catch {
      toast.error("Search failed");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void run(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);
  const add = (h: Hit) => {
    if (kind === "games" && pick?.key !== h.key) {
      setPick(h);
      setHours("0");
      setReview("");
      return;
    }
    onAdd(h.item);
    toast.success(`Added ${h.title}`);
  };
  const confirmGame = () => {
    if (!pick) return;
    const hrs = Math.max(0, Number(hours) || 0);
    onAdd({ ...pick.item, hours: hrs, review: review.trim(), status: hrs > 0 ? "Playing" : "Backlog" });
    toast.success(`Added ${pick.title}`);
    setPick(null);
  };
  return (
    <div className="space-y-2 rounded-md border bg-surface/40 p-2">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "games" ? "Search games to add…" : "Search songs to add…"} />
        <Button type="submit" variant="hudGhost" size="sm" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />}</Button>
      </form>
      {hits.length > 0 && (
        <div className="grid max-h-72 gap-1 overflow-auto">
          {hits.map((h) => (
            <button key={h.key} type="button" className="flex items-center gap-2 rounded p-1 text-left text-sm hover:bg-primary/10" onClick={() => add(h)}>
              {h.image && <img src={h.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />}
              <span className="min-w-0 flex-1"><span className="block truncate">{h.title}</span><span className="block truncate text-xs text-muted-foreground">{h.sub}</span></span>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      )}
      {pick && (
        <div className="space-y-2 rounded-md border border-primary/40 p-2">
          <div className="truncate text-sm font-medium">{pick.title}</div>
          <Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours played" aria-label="Hours played" />
          <Input value={review} onChange={(e) => setReview(e.target.value)} placeholder="A little review…" aria-label="Review" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={confirmGame}>Add game</Button>
            <Button type="button" size="sm" variant="hudGhost" onClick={() => setPick(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
