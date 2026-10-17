import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, appendFile, mkdir } from "node:fs/promises";
import { curate } from "./curate.ts";
import { WIKIS, characters, fetchMedia, voiceLines, type Lang, type WikiId } from "./fandom.ts";

try {
  process.loadEnvFile(); // .env is optional; see .env.example
} catch {}

const app = new Hono();
const wiki = (id: string) => (id in WIKIS ? (id as WikiId) : null);
const slug = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "");
const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

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
  return w ? c.json(await characters(w)) : c.notFound();
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

/** Ask Claude (via `claude -p`) which lines make good cloning samples; returns one verdict per line, same order. */
app.post("/api/:wiki/:name/curate", async (c) => {
  const w = wiki(c.req.param("wiki"));
  if (!w) return c.notFound();
  const name = c.req.param("name");
  const lang = (c.req.query("lang") ?? "en") as Lang;
  const lines = await voiceLines(w, name, lang);
  return c.json(await curate(`${w}-${slug(name)}-${lang}`, lines));
});

type Item = {
  wiki: WikiId;
  character: string;
  lang: Lang;
  title: string;
  url: string;
  text: string;
};

/** Convert each selected clip to 24 kHz mono WAV + metadata.jsonl, the shape XTTS / F5 / Fish ingest. Progress over SSE. */
app.post("/api/export", async (c) => {
  const { items } = (await c.req.json()) as { items: Item[] };
  return streamSSE(c, async (stream) => {
    let done = 0;
    for (const it of items) {
      const w = wiki(it.wiki);
      if (!w) continue;
      const dir = `data/${w}/${slug(it.character)}/${it.lang}`;
      const wav = `${dir}/${slug(it.title)}-${createHash("md5").update(it.url).digest("hex").slice(0, 8)}.wav`;
      if (!(await exists(wav))) {
        await mkdir(dir, { recursive: true });
        const ogg = Buffer.from(await (await fetchMedia(w, it.url)).arrayBuffer());
        await new Promise<void>((res, rej) => {
          const p = execFile(
            "ffmpeg",
            ["-y", "-loglevel", "error", "-i", "pipe:0", "-ar", "24000", "-ac", "1", wav],
            (e) => (e ? rej(e) : res()),
          );
          p.stdin!.end(ogg);
        });
        await appendFile(
          `${dir}/metadata.jsonl`,
          JSON.stringify({
            audio: wav,
            text: it.text,
            title: it.title,
            character: it.character,
            game: w,
            lang: it.lang,
          }) + "\n",
        );
        await new Promise((r) => setTimeout(r, 300)); // ponytail: fixed sleep; token bucket if Fandom starts 429ing
      }
      await stream.writeSSE({
        data: JSON.stringify({ done: ++done, total: items.length, file: wav }),
      });
    }
    await stream.writeSSE({ event: "end", data: JSON.stringify({ done, total: items.length }) });
  });
});

export default app;
