import { useLocalStorage, useMediaControls } from "@vueuse/core";
import { computed, reactive, ref, watch } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import CharacterGrid from "./components/CharacterGrid.vue";
import CharacterView from "./components/CharacterView.vue";

export type Wiki = { id: string; label: string; accent: string; langs: string[] };
export type Character = { name: string; image: string | null; gender: "m" | "f" | null };
export type Line = { section: string; title: string; url: string; text: string };
export type Item = Line & { wiki: string; character: string; lang: string };
export type Verdict = { i: number; keep: boolean; emotion: string; text: string };

export const LANG_LABEL: Record<string, string> = {
  en: "English",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: "/genshin" },
    { path: "/:wiki", name: "grid", component: CharacterGrid },
    { path: "/:wiki/:name", name: "character", component: CharacterView },
  ],
});
export const go = (wiki: string, name = "", lang = "en") =>
  router.push({
    name: name ? "character" : "grid",
    params: name ? { wiki, name } : { wiki },
    query: lang === "en" ? {} : { lang },
  });

export const state = reactive({
  wikis: [] as Wiki[],
  wiki: "genshin",
  character: "",
  lang: "en",
  characters: {} as Record<string, Character[]>,
  lines: [] as Line[],
  loading: false,
  playing: null as Item | null,
  queue: [] as Line[],
  trayOpen: false,
  curated: {} as Record<string, Verdict>,
  curating: false,
});
export const selection = useLocalStorage<Item[]>("voicebank:selection", []);

export const wiki = () => state.wikis.find((w) => w.id === state.wiki);
export const media = (wikiId: string, url: string) =>
  `/api/${wikiId}/media?u=${encodeURIComponent(url)}`;
export const portrait = (c: Character, width = 480) =>
  c.image
    ? media(state.wiki, c.image.replace(/scale-to-width-down\/\d+/, `scale-to-width-down/${width}`))
    : "";
export const isSelected = (url: string) => selection.value.some((i) => i.url === url);
export const toggle = (line: Line) => {
  const i = selection.value.findIndex((s) => s.url === line.url);
  if (i >= 0) selection.value.splice(i, 1);
  else
    selection.value.push({
      ...line,
      wiki: state.wiki,
      character: state.character,
      lang: state.lang,
    });
};

/** One <audio autoplay> lives in Player.vue; VueUse keeps playing/currentTime/duration in sync with it. */
export const audioEl = ref<HTMLAudioElement>();
export const { playing, currentTime, duration, ended } = useMediaControls(audioEl, {
  src: computed(() => (state.playing ? media(state.playing.wiki, state.playing.url) : "")),
});
watch(ended, (e) => e && step(1));

/** Playing snapshots the current character's lines as the queue, so prev/next keep working after navigating away. */
/** A plain Line comes from the current character page; an Item (sample set) carries its own wiki/character/lang. */
export function play(line: Line | Item, queue: Line[] = state.lines) {
  if (state.playing?.url === line.url) playing.value = !playing.value;
  else {
    state.playing = { wiki: state.wiki, character: state.character, lang: state.lang, ...line };
    state.queue = queue;
  }
}
export function step(dir: 1 | -1) {
  const i = state.queue.findIndex((l) => l.url === state.playing?.url);
  const next = state.queue[i + dir];
  if (next) state.playing = { ...state.playing!, ...next };
}

const get = (url: string, init?: RequestInit) => fetch(url, init).then((r) => r.json());

/** Claude's verdicts keyed by clip url; cleaned transcripts replace the originals so exports get them too. */
export async function curate() {
  state.curating = true;
  try {
    const verdicts: Verdict[] = await get(
      `/api/${state.wiki}/${encodeURIComponent(state.character)}/curate?lang=${state.lang}`,
      { method: "POST" },
    );
    for (const v of verdicts) {
      const line = state.lines[v.i];
      if (!line) continue;
      line.text = v.text;
      state.curated[line.url] = v;
    }
  } finally {
    state.curating = false;
  }
}
export const picks = () => state.lines.filter((l) => state.curated[l.url]?.keep);
export const init = async () => (state.wikis = await get("/api/wikis"));

watch(
  router.currentRoute,
  (r) => {
    state.wiki = String(r.params.wiki ?? "genshin");
    state.character = String(r.params.name ?? "");
    state.lang = String(r.query.lang ?? "en");
  },
  { immediate: true },
);

watch(
  () => [state.wiki, state.wikis] as const,
  async ([w]) => {
    document.documentElement.style.setProperty("--accent", wiki()?.accent ?? "#e3b95c");
    if (state.wikis.length && !state.characters[w])
      state.characters[w] = await get(`/api/${w}/characters`);
  },
  { immediate: true },
);

watch(
  () => [state.wiki, state.character, state.lang],
  async ([w, name, lang]) => {
    state.lines = [];
    state.curated = {};
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
