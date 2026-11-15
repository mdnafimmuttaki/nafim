/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Search, Loader2, Plus, Play, Pause } from "lucide-react";
import { searchSteam } from "@/lib/search.functions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SearchKind = "games" | "tracks";
type Hit = { key: string; title: string; sub: string; image: string; preview?: string; item: any };
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const steamCover = (id: string) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`;
const gameItem = (title: string, cover: string) => ({
  id: uid("gm"),
  title,
  platform: "PC",
  status: "Backlog",
  hours: 0,
  rating: 7,
  review: "",
  favorite: false,
  image: cover,
});
async function searchGames(q: string): Promise<Hit[]> {
  const [steam, shark] = await Promise.all([
    searchSteam({ data: q }).catch(() => []),
    fetch(`https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(q)}&limit=12`)
      .then((r) => r.json())
      .catch(() => []),
  ]);
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const g of steam) {
    seen.add(g.id);
    out.push({
      key: `s${g.id}`,
      title: g.name,
      sub: "PC · Steam",
      image: steamCover(g.id),
      item: gameItem(g.name, steamCover(g.id)),
    });
  }
  for (const g of shark as any[]) {
    if (g.steamAppID && seen.has(g.steamAppID)) continue;
    const cover = g.steamAppID ? steamCover(g.steamAppID) : g.thumb;
    out.push({
      key: `c${g.gameID}`,
      title: g.external,
      sub: "PC",
      image: cover,
      item: gameItem(g.external, cover),
    });
  }
  return out;
}

// Audius: free, keyless, full-length streams.
const AUDIUS = "https://api.audius.co/v1";
const APP = "app_name=naphium-portfolio";
const trackItem = (title: string, artist: string, url: string, cover: string) => ({
  id: uid("trk"),
  title,
  artist,
  url,
  cover,
  notes: [261.63, 329.63, 392],
  bpm: 120,
  wave: "square",
});
// iTunes: every mainstream song (official 30s previews). Audius: full-length indie tracks.
async function searchTracks(q: string): Promise<Hit[]> {
  const [it, au] = await Promise.all([
    fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15`,
    )
      .then((r) => r.json())
      .catch(() => ({})),
    fetch(`${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=8&${APP}`)
      .then((r) => r.json())
      .catch(() => ({})),
  ]);
  const a: Hit[] = (it.results ?? [])
    .filter((t: any) => t.previewUrl)
    .map((t: any) => {
      const cover = String(t.artworkUrl100 ?? "").replace("100x100", "600x600");
      return {
        key: `i${t.trackId}`,
        title: t.trackName,
        sub: `${t.artistName} · ${t.collectionName ?? ""} · preview`,
        image: cover,
        preview: t.previewUrl,
        item: trackItem(t.trackName, t.artistName, t.previewUrl, cover),
      };
    });
  const b: Hit[] = (au.data ?? [])
    .filter((t: any) => t.is_streamable !== false)
    .map((t: any) => {
      const url = `${AUDIUS}/tracks/${t.id}/stream?${APP}`;
      const cover = t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? "";
      return {
        key: `a${t.id}`,
        title: t.title,
        sub: `${t.user?.name ?? ""} · ${Math.round((t.duration ?? 0) / 60)} min · full track`,
        image: cover,
        preview: url,
        item: trackItem(t.title, t.user?.name ?? "", url, cover),
      };
    });
  return [...a, ...b];
}

let previewEl: HTMLAudioElement | null = null;

export function ListSearch({ kind, onAdd }: { kind: SearchKind; onAdd: (item: any) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [pick, setPick] = useState<Hit | null>(null);
  const [hours, setHours] = useState("0");
  const [review, setReview] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(
    () => () => {
      previewEl?.pause();
    },
    [],
  );
  const togglePreview = (h: Hit) => {
    if (!previewEl) previewEl = new Audio();
    if (playing === h.key) {
      previewEl.pause();
      setPlaying(null);
      return;
    }
    previewEl.src = h.preview!;
    previewEl.onended = () => setPlaying(null);
    previewEl
      .play()
      .then(() => setPlaying(h.key))
      .catch(() => toast.error("Can't play preview"));
  };
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
    onAdd({
      ...pick.item,
      hours: hrs,
      review: review.trim(),
      status: hrs > 0 ? "Playing" : "Backlog",
    });
    toast.success(`Added ${pick.title}`);
    setPick(null);
  };
  return (
    <div className="space-y-2 rounded-md border bg-surface/40 p-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "games" ? "Search games to add…" : "Search songs to add…"}
        />
        <Button type="submit" variant="hudGhost" size="sm" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>
      {hits.length > 0 && (
        <div className="grid max-h-72 gap-1 overflow-auto">
          {hits.map((h) => (
            <div
              key={h.key}
              className="flex items-center gap-2 rounded p-1 text-sm hover:bg-primary/10"
            >
              {h.preview ? (
                <button
                  type="button"
                  onClick={() => togglePreview(h)}
                  aria-label={playing === h.key ? "Pause preview" : "Play preview"}
                  className="group relative h-10 w-10 shrink-0 overflow-hidden rounded"
                >
                  {h.image && (
                    <img
                      src={h.image}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <span
                    className={`absolute inset-0 flex items-center justify-center bg-background/60 transition-opacity ${playing === h.key ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    {playing === h.key ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </span>
                </button>
              ) : (
                h.image && (
                  <img
                    src={h.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                )
              )}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => add(h)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                </span>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            </div>
          ))}
        </div>
      )}
      {pick && (
        <div className="space-y-2 rounded-md border border-primary/40 p-2">
          <div className="truncate text-sm font-medium">{pick.title}</div>
          <Input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours played"
            aria-label="Hours played"
          />
          <Input
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="A little review…"
            aria-label="Review"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={confirmGame}>
              Add game
            </Button>
            <Button type="button" size="sm" variant="hudGhost" onClick={() => setPick(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
