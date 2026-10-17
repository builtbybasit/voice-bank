import { reactive, watch } from "vue";

export type Wiki = { id: string; label: string; accent: string; langs: string[] };
export type Character = { name: string; image: string | null };
export type Line = { section: string; title: string; url: string; text: string };
export type Item = Line & { wiki: string; character: string; lang: string };

export const LANG_LABEL: Record<string, string> = {
  en: "English",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem("voicebank:selection") ?? "[]") as Item[];
  } catch {
    return [];
  }
})();

export const state = reactive({
  wikis: [] as Wiki[],
  wiki: "genshin",
  character: "",
  lang: "en",
  characters: {} as Record<string, Character[]>,
  lines: [] as Line[],
  loading: false,
  selection: saved,
  playing: null as Item | null,
  queue: [] as Line[],
  paused: true,
  trayOpen: false,
});

export const wiki = () => state.wikis.find((w) => w.id === state.wiki);
export const media = (wikiId: string, url: string) =>
  `/api/${wikiId}/media?u=${encodeURIComponent(url)}`;
export const portrait = (c: Character, width = 480) =>
  c.image
    ? media(state.wiki, c.image.replace(/scale-to-width-down\/\d+/, `scale-to-width-down/${width}`))
    : "";
export const isSelected = (url: string) => state.selection.some((i) => i.url === url);
export const toggle = (line: Line) => {
  const i = state.selection.findIndex((s) => s.url === line.url);
  if (i >= 0) state.selection.splice(i, 1);
  else
    state.selection.push({
      ...line,
      wiki: state.wiki,
      character: state.character,
      lang: state.lang,
    });
};

/** Playing snapshots the current character's lines as the queue, so prev/next keep working after navigating away. */
export function play(line: Line) {
  if (state.playing?.url === line.url) state.paused = !state.paused;
  else {
    state.playing = { ...line, wiki: state.wiki, character: state.character, lang: state.lang };
    state.queue = state.lines;
    state.paused = false;
  }
}
export function step(dir: 1 | -1) {
  const i = state.queue.findIndex((l) => l.url === state.playing?.url);
  const next = state.queue[i + dir];
  if (next) state.playing = { ...state.playing!, ...next };
}

const get = (url: string) => fetch(url).then((r) => r.json());

export async function init() {
  state.wikis = await get("/api/wikis");
  readHash();
  window.addEventListener("hashchange", readHash);
}

function readHash() {
  const [path, qs] = location.hash.slice(1).split("?");
  const [, w = "genshin", name = ""] = path.split("/");
  state.wiki = state.wikis.some((x) => x.id === w) ? w : "genshin";
  state.character = decodeURIComponent(name);
  state.lang = new URLSearchParams(qs).get("lang") ?? "en";
}

watch(
  () => [state.wiki, state.character, state.lang],
  () => {
    const q = state.lang !== "en" ? `?lang=${state.lang}` : "";
    const h = `/${state.wiki}${state.character ? `/${encodeURIComponent(state.character)}` : ""}${q}`;
    if (location.hash.slice(1) !== h) history.replaceState(null, "", `#${h}`);
  },
);

watch(
  () => state.wiki,
  async (w) => {
    document.documentElement.style.setProperty("--accent", wiki()?.accent ?? "#e3b95c");
    if (!wiki()?.langs.includes(state.lang)) state.lang = "en";
    if (!state.characters[w]) state.characters[w] = await get(`/api/${w}/characters`);
  },
  { immediate: true },
);

watch(
  () => [state.wiki, state.character, state.lang],
  async ([w, name, lang]) => {
    state.lines = [];
    window.scrollTo({ top: 0 });
    if (!name) return;
    state.loading = true;
    try {
      state.lines = await get(`/api/${w}/${encodeURIComponent(name)}/lines?lang=${lang}`);
    } finally {
      state.loading = false;
    }
  },
  { immediate: true },
);

watch(
  () => state.selection,
  (s) => localStorage.setItem("voicebank:selection", JSON.stringify(s)),
  { deep: true },
);
