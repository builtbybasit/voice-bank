import { Hono } from "hono";
import { curate } from "./curate.ts";
import {
  WIKIS,
  characters,
  fetchMedia,
  voiceLines,
  type Kv,
  type Lang,
  type WikiId,
} from "./fandom.ts";

try {
  process.loadEnvFile(); // .env is optional; see .env.example
} catch {}

const app = new Hono<{ Bindings: { CACHE?: Kv } }>(); // CACHE is unset under vp dev, so disk() uses files
const wiki = (id: string) => (id in WIKIS ? (id as WikiId) : null);
const slug = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "");

app.get("/api/wikis", (c) =>
  c.json(
    Object.entries(WIKIS).map(([id, w]) => ({
      id,
      label: w.label,
      accent: w.accent,
      langs: Object.keys(w.langs),
    })),
  ),
);

app.get("/api/:wiki/characters", async (c) => {
  const w = wiki(c.req.param("wiki"));
  return w ? c.json(await characters(w, c.env.CACHE)) : c.notFound();
});

// Buffered so Range requests work: Chrome needs them to read an Ogg's duration. Clips are a few hundred KB at most.
app.get("/api/:wiki/media", async (c) => {
  const w = wiki(c.req.param("wiki"));
  const u = c.req.query("u");
  if (!w || !u) return c.notFound();
  const res = await fetchMedia(w, u);
  const buf = new Uint8Array(await res.arrayBuffer());
  const headers: Record<string, string> = {
    "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "public, max-age=604800",
    "Accept-Ranges": "bytes",
  };
  const m = c.req.header("range")?.match(/bytes=(\d*)-(\d*)/);
  if (!m)
    return new Response(buf, { headers: { ...headers, "Content-Length": String(buf.length) } });
  const from = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2]));
  const to = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
  return new Response(buf.slice(from, to + 1), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${from}-${to}/${buf.length}`,
      "Content-Length": String(to - from + 1),
    },
  });
});

app.get("/api/:wiki/:name/lines", async (c) => {
  const w = wiki(c.req.param("wiki"));
  return w
    ? c.json(await voiceLines(w, c.req.param("name"), (c.req.query("lang") ?? "en") as Lang))
    : c.notFound();
});

/** Ask Claude (via `claude -p`, so local `vp dev` only; the UI hides it in builds) which lines make good cloning samples; returns one verdict per line, same order. */
app.post("/api/:wiki/:name/curate", async (c) => {
  const w = wiki(c.req.param("wiki"));
  if (!w) return c.notFound();
  const name = c.req.param("name");
  const lang = (c.req.query("lang") ?? "en") as Lang;
  const lines = await voiceLines(w, name, lang);
  return c.json(await curate(`${w}-${slug(name)}-${lang}`, lines));
});

export default app;
