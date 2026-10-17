// Fandom wikis are MediaWiki: use api.php, never scrape blind HTML.
export const WIKIS = {
  genshin: {
    base: "https://genshin-impact.fandom.com",
    list: "Character/List",
    vo: "Voice-Overs",
    label: "Genshin Impact",
    accent: "#e3b95c",
    langs: { en: "", ja: "Japanese", zh: "Chinese", ko: "Korean" },
  },
  hsr: {
    base: "https://honkai-star-rail.fandom.com",
    list: "Character/List",
    vo: "Voice-Overs",
    label: "Honkai: Star Rail",
    accent: "#9d8cff",
    langs: { en: "", ja: "Japanese", zh: "Chinese", ko: "Korean" },
  },
  zzz: {
    base: "https://zenless-zone-zero.fandom.com",
    list: "Agent/List",
    vo: "Voice-Overs",
    label: "Zenless Zone Zero",
    accent: "#c9f464",
    langs: { en: "" },
  },
  wuwa: {
    base: "https://wutheringwaves.fandom.com",
    list: "Resonator/List",
    vo: "Voicelines",
    label: "Wuthering Waves",
    accent: "#5fd6c6",
    langs: { en: "", ja: "Japanese", zh: "Chinese", ko: "Korean" },
  },
} as const;
export type WikiId = keyof typeof WIKIS;
export type Lang = "en" | "ja" | "zh" | "ko";
export type Character = { name: string; image: string | null };
export type Line = { section: string; title: string; url: string; text: string };

const SKIP_SECTIONS = new Set(["Navigation", "Change History"]);
const cache = new Map<string, Promise<unknown>>();

// ponytail: process-lifetime memo; a disk cache if restarts get annoying
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = fn();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

async function api(wiki: WikiId, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, format: "json" });
  const res = await fetch(`${WIKIS[wiki].base}/api.php?${qs}`, {
    headers: { "User-Agent": "voicebank (local dev)" },
  });
  if (!res.ok) throw new Error(`${wiki} ${params.action} ${res.status}`);
  return res.json();
}

// ponytail: tooltip bodies assumed span-free inside; use a real HTML parser if WuWa nests deeper
const strip = (html: string) =>
  html
    .replace(/<span class="wuwa-extra-effect-(header|content)">[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const chunks = <T>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Characters on the list page that actually have a voice page, with a portrait. */
export const characters = (wiki: WikiId) =>
  memo(`chars:${wiki}`, async (): Promise<Character[]> => {
    const { list, vo } = WIKIS[wiki];
    const data = await api(wiki, { action: "parse", page: list, prop: "links" });
    const names: string[] = data.parse.links
      .filter((l: any) => l.ns === 0 && "exists" in l)
      .map((l: any) => l["*"]);
    const found = new Set<string>();
    for (const chunk of chunks(names, 50)) {
      const q = await api(wiki, {
        action: "query",
        titles: chunk.map((n) => `${n}/${vo}`).join("|"),
      });
      for (const p of Object.values<any>(q.query.pages))
        if (!("missing" in p)) found.add(p.title.split("/")[0]);
    }
    const image = new Map<string, string>();
    for (const chunk of chunks([...found], 50)) {
      const q = await api(wiki, {
        action: "query",
        titles: chunk.join("|"),
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "480",
      });
      for (const p of Object.values<any>(q.query.pages))
        if (p.thumbnail) image.set(p.title, p.thumbnail.source);
    }
    return [...found].sort().map((name) => ({ name, image: image.get(name) ?? null }));
  });

/** Every row with an audio clip and a transcript, grouped by h2 section. Rows without text (combat grunts) are dropped. */
export const voiceLines = (wiki: WikiId, name: string, lang: Lang) =>
  memo(`lines:${wiki}:${name}:${lang}`, async (): Promise<Line[]> => {
    const { vo, langs } = WIKIS[wiki];
    const suffix = (langs as Record<string, string>)[lang];
    if (suffix === undefined) return [];
    const page = `${name}/${vo}${suffix ? `/${suffix}` : ""}`;
    const data = await api(wiki, { action: "parse", page, prop: "text" });
    const html: string = data.parse.text["*"];
    const lines: Line[] = [];
    for (const block of html.split("<h2").slice(1)) {
      const head = block.slice(0, block.indexOf("</h2>"));
      const section = strip(head.match(/id="([^"]+)"/)?.[1] ?? "").replace(/_/g, " ");
      if (SKIP_SECTIONS.has(section)) continue;
      let title = "";
      for (const row of block.split("<tr")) {
        const url = row.match(/https:\/\/static\.wikia\.nocookie\.net\/[^"\s]+?\.ogg[^"\s]*/)?.[0];
        title = strip(row.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? title); // rowspan: title carries to following rows
        const cells = [
          ...row
            .replace(/<audio[\s\S]*?<\/audio>|<a [^>]*class="internal"[^>]*>[\s\S]*?<\/a>/g, "")
            .matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g),
        ].map((m) => strip(m[1]));
        const text = cells.filter(Boolean).at(-1) ?? "";
        if (url && title && text) lines.push({ section, title, url, text });
      }
    }
    return lines;
  });

/** The CDN 403s without a Referer from the wiki. Only CDN URLs are allowed through. */
export async function fetchMedia(wiki: WikiId, url: string): Promise<Response> {
  if (!url.startsWith("https://static.wikia.nocookie.net/")) throw new Error("not a wikia CDN url");
  const res = await fetch(url, { headers: { Referer: `${WIKIS[wiki].base}/` } });
  if (!res.ok) throw new Error(`media ${res.status} ${url}`);
  return res;
}
