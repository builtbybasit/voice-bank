import { Hono } from "hono";
import { execFile } from "node:child_process";
import { mkdir, appendFile, access } from "node:fs/promises";
import { WIKIS, characters, fetchAudio, voiceLines, type WikiId } from "./fandom.ts";

const app = new Hono();
const wiki = (id: string) => (id in WIKIS ? (id as WikiId) : null);

app.get("/api/wikis", (c) =>
  c.json(Object.entries(WIKIS).map(([id, w]) => ({ id, label: w.label }))),
);

app.get("/api/:wiki/characters", async (c) => {
  const w = wiki(c.req.param("wiki"));
  return w ? c.json(await characters(w)) : c.notFound();
});

app.get("/api/:wiki/:name/lines", async (c) => {
  const w = wiki(c.req.param("wiki"));
  return w ? c.json(await voiceLines(w, c.req.param("name"))) : c.notFound();
});

app.get("/api/:wiki/audio", async (c) => {
  const w = wiki(c.req.param("wiki"));
  const u = c.req.query("u");
  if (!w || !u) return c.notFound();
  const res = await fetchAudio(w, u);
  return new Response(res.body, {
    headers: { "Content-Type": "audio/ogg", "Cache-Control": "public, max-age=86400" },
  });
});

/** Download every clip as 24 kHz mono WAV + metadata.jsonl, the shape XTTS / F5 / Fish ingest. */
app.post("/api/:wiki/:name/download", async (c) => {
  const w = wiki(c.req.param("wiki"));
  if (!w) return c.notFound();
  const name = c.req.param("name");
  const dir = `data/${w}/${name.replace(/[^\w-]+/g, "_")}`;
  await mkdir(dir, { recursive: true });
  const lines = await voiceLines(w, name);
  let done = 0;
  for (const [i, line] of lines.entries()) {
    const wav = `${dir}/${String(i).padStart(3, "0")}.wav`;
    if (
      await access(wav).then(
        () => true,
        () => false,
      )
    ) {
      done++;
      continue;
    }
    const ogg = Buffer.from(await (await fetchAudio(w, line.url)).arrayBuffer());
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
      JSON.stringify({ audio: wav, text: line.text, title: line.title, character: name, game: w }) +
        "\n",
    );
    done++;
    await new Promise((r) => setTimeout(r, 300)); // ponytail: fixed sleep; token bucket if Fandom starts 429ing
  }
  return c.json({ dir, done, total: lines.length });
});

export default app;
