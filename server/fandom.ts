// Fandom wikis are MediaWiki: use api.php, never scrape blind HTML.
export const WIKIS = {
  genshin: {
    base: "https://genshin-impact.fandom.com",
    list: "Character/List",
    vo: "Voice-Overs",
    label: "Genshin Impact",
  },
  hsr: {
    base: "https://honkai-star-rail.fandom.com",
    list: "Character/List",
    vo: "Voice-Overs",
    label: "Honkai: Star Rail",
  },
  zzz: {
    base: "https://zenless-zone-zero.fandom.com",
    list: "Agent/List",
    vo: "Voice-Overs",
    label: "Zenless Zone Zero",
  },
  wuwa: {
    base: "https://wutheringwaves.fandom.com",
    list: "Resonator/List",
    vo: "Voicelines",
    label: "Wuthering Waves",
  },
} as const;
export type WikiId = keyof typeof WIKIS;

export type Line = { title: string; url: string; text: string };

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

/** Character names on the list page that actually have a voice page. */
export async function characters(wiki: WikiId): Promise<string[]> {
  const { base: _, list, vo } = WIKIS[wiki];
  const data = await api(wiki, { action: "parse", page: list, prop: "links" });
  const names: string[] = data.parse.links
    .filter((l: any) => l.ns === 0 && "exists" in l)
    .map((l: any) => l["*"]);
  const found: string[] = [];
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    const q = await api(wiki, {
      action: "query",
      titles: chunk.map((n) => `${n}/${vo}`).join("|"),
    });
    for (const p of Object.values<any>(q.query.pages))
      if (!("missing" in p)) found.push(p.title.split("/")[0]);
  }
  return [...new Set(found)].sort();
}

/** Every row with an audio clip and a transcript. Rows without text (combat grunts) are dropped. */
export async function voiceLines(wiki: WikiId, name: string): Promise<Line[]> {
  const data = await api(wiki, {
    action: "parse",
    page: `${name}/${WIKIS[wiki].vo}`,
    prop: "text",
  });
  const html: string = data.parse.text["*"];
  const lines: Line[] = [];
  let title = "";
  for (const row of html.split("<tr")) {
    const url = row.match(/https:\/\/static\.wikia\.nocookie\.net\/[^"\s]+?\.ogg[^"\s]*/)?.[0];
    title = strip(row.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? title); // rowspan: title carries to following rows
    const cells = [
      ...row
        .replace(/<audio[\s\S]*?<\/audio>|<a [^>]*class="internal"[^>]*>[\s\S]*?<\/a>/g, "")
        .matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g),
    ].map((m) => strip(m[1]));
    const text = cells.filter(Boolean).at(-1) ?? "";
    if (url && title && text) lines.push({ title, url, text });
  }
  return lines;
}

/** The CDN 403s without a Referer from the wiki. Only CDN URLs are allowed through. */
export async function fetchAudio(wiki: WikiId, url: string): Promise<Response> {
  if (!url.startsWith("https://static.wikia.nocookie.net/")) throw new Error("not a wikia CDN url");
  const res = await fetch(url, { headers: { Referer: `${WIKIS[wiki].base}/` } });
  if (!res.ok) throw new Error(`audio ${res.status} ${url}`);
  return res;
}
