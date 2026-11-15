import { createServerFn } from "@tanstack/react-start";

// Steam store search (no CORS in browser, so proxied here). Covers old classics too.
export const searchSteam = createServerFn({ method: "GET" })
  .inputValidator((q: string) => String(q).slice(0, 100))
  .handler(async ({ data }) => {
    try {
      const r = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(data)}&l=english&cc=us`);
      const j = (await r.json()) as { items?: { id: number; name: string }[] };
      return (j.items ?? []).map((i) => ({ id: String(i.id), name: i.name }));
    } catch {
      return [];
    }
  });
