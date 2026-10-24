import { Hono } from "hono";
import { curate } from "./curate.ts";
import { WIKIS, characters, flush, voiceLines, type Kv, type Lang, type WikiId } from "./fandom.ts";

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

app.post("/api/:wiki/flush", async (c) => {
  const w = wiki(c.req.param("wiki"));
  if (!w) return c.notFound();
  await flush(w, c.env.CACHE);
  return c.body(null, 204);
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
