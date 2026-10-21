// Fandom wikis are MediaWiki: use api.php, never scrape blind HTML.
import * as cheerio from "cheerio/slim"; // the full entry imports undici, which Workers lack
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

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
export type Gender = "m" | "f" | null;
export type Character = { name: string; image: string | null; gender: Gender };
export type Line = { section: string; title: string; url: string; text: string };

const SKIP_SECTIONS = new Set(["Navigation", "Change History"]);
// Gender categories across all wikis (HSR has none; see the pronoun fallback in characters()).
const GENDER_CATS = ["Agents", "Resonators", "Characters"]
  .flatMap((n) =>
    ["Tall ", "Medium ", "Short ", ""].flatMap((s) => [`${s}Male ${n}`, `${s}Female ${n}`]),
  )
  .map((c) => `Category:${c}`)
  .join("|");
const cache = new Map<string, Promise<unknown>>();
const DISK_TTL = 24 * 60 * 60 * 1000;

/** JSON file cache under data/cache, refreshed when older than DISK_TTL. Delete the file to force a refetch. */
export async function disk<T>(name: string, fn: () => Promise<T>, ttl = DISK_TTL): Promise<T> {
  const path = `data/cache/${name}.json`;
  const fresh = await stat(path).then(
    (s) => Date.now() - s.mtimeMs < ttl,
    () => false,
  );
  if (fresh) return JSON.parse(await readFile(path, "utf8"));
  const value = await fn();
  // Workers' filesystem is read-only: the write fails there and memo() caches per isolate instead.
  await mkdir("data/cache", { recursive: true })
    .then(() => writeFile(path, JSON.stringify(value)))
    .catch(() => {});
  return value;
}

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

const chunks = <T>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Characters on the list page that actually have a voice page, with a portrait. */
export const characters = (wiki: WikiId) =>
  memo(`chars:${wiki}`, () =>
    disk(`characters-${wiki}`, async (): Promise<Character[]> => {
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
      const gender = new Map<string, Gender>();
      for (const chunk of chunks([...found], 50)) {
        const q = await api(wiki, {
          action: "query",
          titles: chunk.join("|"),
          prop: "pageimages|categories",
          piprop: "thumbnail",
          pithumbsize: "480",
          clcategories: GENDER_CATS,
          cllimit: "max",
        });
        for (const p of Object.values<any>(q.query.pages)) {
          if (p.thumbnail) image.set(p.title, p.thumbnail.source);
          const g = new Set<Gender>(
            (p.categories ?? []).map((c: any) => (/Female/.test(c.title) ? "f" : "m")),
          );
          if (g.size === 1) gender.set(p.title, [...g][0]!); // both (Traveler) stays unknown
        }
      }
      // No gender categories (HSR): count pronouns in the third-person Lore subpage.
      const unknown = [...found].filter((n) => !gender.has(n));
      for (const chunk of chunks(unknown, 50)) {
        const q = await api(wiki, {
          action: "query",
          titles: chunk.map((n) => `${n}/Lore`).join("|"),
          prop: "revisions",
          rvprop: "content",
          rvslots: "main",
        });
        for (const p of Object.values<any>(q.query.pages)) {
          const t: string = p.revisions?.[0].slots.main["*"] ?? "";
          const f = t.match(/\b(she|her|hers|herself)\b/gi)?.length ?? 0;
          const m = t.match(/\b(he|him|his|himself)\b/gi)?.length ?? 0;
          const name = p.title.replace(/\/Lore$/, "");
          if (f + m < 5) continue; // too little prose (Trailblazer is both)
          if (f > m * 2) gender.set(name, "f");
          else if (m > f * 2) gender.set(name, "m");
        }
      }
      return [...found].sort().map((name) => ({
        name,
        image: image.get(name) ?? null,
        gender: gender.get(name) ?? null,
      }));
    }),
  );

const text = (el: cheerio.Cheerio<any>) => el.text().replace(/\s+/g, " ").trim();

/** Every row with an audio clip and a transcript, grouped by h2 section. Rows without text (combat grunts) are dropped. */
export const voiceLines = (wiki: WikiId, name: string, lang: Lang) =>
  memo(`lines:${wiki}:${name}:${lang}`, async (): Promise<Line[]> => {
    const { vo, langs } = WIKIS[wiki];
    const suffix = (langs as Record<string, string>)[lang];
    if (suffix === undefined) return [];
    const data = await api(wiki, {
      action: "parse",
      page: `${name}/${vo}${suffix ? `/${suffix}` : ""}`,
      prop: "text",
    });
    const $ = cheerio.load(data.parse.text["*"]);
    $(".mw-editsection, .wuwa-extra-effect-header, .wuwa-extra-effect-content").remove(); // edit links + hidden lore tooltips
    const lines: Line[] = [];
    $("h2").each((_, h2) => {
      const section = text($(h2));
      if (SKIP_SECTIONS.has(section)) return;
      const heading = $(h2).parent().is(".mw-heading") ? $(h2).parent() : $(h2);
      let title = "";
      heading
        .nextUntil(".mw-heading, h2")
        .find("tr")
        .each((_, tr) => {
          const row = $(tr);
          const url = row.find("audio").attr("src") ?? row.find('a[href*=".ogg"]').attr("href");
          row.find("audio, a.internal").remove();
          title = text(row.find("th").first()) || title; // rowspan: title carries to following rows
          const transcript =
            row
              .find("td")
              .map((_, td) => text($(td)))
              .get()
              .filter(Boolean)
              .at(-1) ?? "";
          if (url && transcript) lines.push({ section, title, url, text: transcript });
        });
    });
    return lines;
  });

/** The CDN 403s without a Referer from the wiki. Only CDN URLs are allowed through. */
export async function fetchMedia(wiki: WikiId, url: string): Promise<Response> {
  if (!url.startsWith("https://static.wikia.nocookie.net/")) throw new Error("not a wikia CDN url");
  const res = await fetch(url, { headers: { Referer: `${WIKIS[wiki].base}/` } });
  if (!res.ok) throw new Error(`media ${res.status} ${url}`);
  return res;
}
