<script setup lang="ts">
import { Download, LoaderCircle, Pause, Play, Trash2, X } from "@lucide/vue";
import { strToU8, zipSync } from "fflate";
import { computed, ref } from "vue";
import {
  LANG_LABEL,
  isLoading,
  media,
  play,
  playing,
  selection,
  state,
  type Item,
} from "@/store.ts";

const groups = computed(() =>
  Map.groupBy(selection.value, (i) => `${i.wiki}/${i.character}/${i.lang}`)
    .values()
    .toArray(),
);
const remove = (i: Item) => selection.value.splice(selection.value.indexOf(i), 1);
const label = (id: string) => state.wikis.find((w) => w.id === id)?.label ?? id;

const progress = ref<{ done: number; total: number; file?: string } | null>(null);
const result = ref("");
let zipUrl = "";

const slug = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "");
const hash = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))]
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** 24 kHz mono 16-bit WAV, what ffmpeg -ar 24000 -ac 1 wrote. decodeAudioData resamples to the context's rate. */
async function wav(ogg: ArrayBuffer) {
  const buf = await new OfflineAudioContext(1, 1, 24000).decodeAudioData(ogg);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const n = buf.length;
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const ascii = (at: number, s: string) =>
    [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  ascii(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 24000, true);
  v.setUint32(28, 48000, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = chans.reduce((a, d) => a + d[i]!, 0) / chans.length;
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
  }
  return new Uint8Array(v.buffer);
}

/** Same layout the old server export wrote under data/, zipped: unzip in the project root to get data/{game}/{Character}/{lang}/. */
async function exportAll() {
  const items = selection.value.slice();
  const files: Record<string, Uint8Array> = {};
  const meta: Record<string, string> = {};
  result.value = "";
  progress.value = { done: 0, total: items.length };
  try {
    for (const [done, it] of items.entries()) {
      const dir = `data/${it.wiki}/${slug(it.character)}/${it.lang}`;
      const file = `${dir}/${slug(it.title)}-${await hash(it.url)}.wav`;
      const res = await fetch(media(it.wiki, it.url));
      if (!res.ok) throw new Error(`${it.title}: ${res.status}`);
      files[file] = await wav(await res.arrayBuffer());
      meta[dir] =
        (meta[dir] ?? "") +
        JSON.stringify({
          audio: file,
          text: it.text,
          title: it.title,
          character: it.character,
          game: it.wiki,
          lang: it.lang,
        }) +
        "\n";
      progress.value = { done: done + 1, total: items.length, file };
      await new Promise((r) => setTimeout(r, 300)); // ponytail: fixed sleep; token bucket if Fandom starts 429ing
    }
    for (const [dir, m] of Object.entries(meta)) files[`${dir}/metadata.jsonl`] = strToU8(m);
    // Revoke only the previous zip: revoking this one before a Save As dialog closes makes the
    // browser fall back to the blob's UUID as the filename and fail the download.
    URL.revokeObjectURL(zipUrl);
    zipUrl = URL.createObjectURL(
      new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
    );
    const a = Object.assign(document.createElement("a"), {
      href: zipUrl,
      download: "voicebank.zip",
    });
    document.body.append(a); // Firefox ignores clicks on detached links
    a.click();
    a.remove();
    result.value = `${items.length} WAV files + metadata.jsonl downloaded as voicebank.zip`;
  } catch (e) {
    result.value = `Export failed: ${(e as Error).message}`;
  } finally {
    progress.value = null;
  }
}
</script>

<template>
  <Transition name="slide">
    <aside v-if="state.trayOpen" class="tray">
      <header>
        <div>
          <h2>Sample set</h2>
          <p class="muted">{{ selection.length }} clips · 24 kHz mono WAV + metadata.jsonl</p>
        </div>
        <button class="icon" aria-label="Close" @click="state.trayOpen = false">
          <X :size="18" />
        </button>
      </header>

      <div class="tray-body">
        <p v-if="!selection.length" class="empty">
          Nothing yet. Add lines with <b>+</b> or “Add all to sample set”.
        </p>
        <section v-for="g in groups" :key="g[0].wiki + g[0].character + g[0].lang">
          <h3>
            {{ g[0].character }}
            <small>{{ label(g[0].wiki) }} · {{ LANG_LABEL[g[0].lang] }} · {{ g.length }}</small>
          </h3>
          <ul>
            <li v-for="i in g" :key="i.url" :class="{ playing: state.playing?.url === i.url }">
              <button
                class="icon"
                :aria-label="state.playing?.url === i.url && playing ? 'Pause' : 'Play'"
                @click="play(i, g)"
              >
                <LoaderCircle v-if="isLoading(i.url)" class="spin" :size="14" />
                <Pause v-else-if="state.playing?.url === i.url && playing" :size="14" />
                <Play v-else :size="14" />
              </button>
              <span
                ><b>{{ i.title }}</b
                ><small>{{ i.text }}</small></span
              >
              <button class="icon" aria-label="Remove" @click="remove(i)"><X :size="14" /></button>
            </li>
          </ul>
        </section>
      </div>

      <footer>
        <div v-if="progress" class="progress">
          <div class="bar">
            <div :style="{ width: `${(progress.done / progress.total) * 100}%` }"></div>
          </div>
          <small>{{ progress.done }}/{{ progress.total }} {{ progress.file ?? "" }}</small>
        </div>
        <p v-else-if="result" class="muted">{{ result }}</p>
        <div class="row">
          <button
            class="ghost"
            :disabled="!selection.length || !!progress"
            @click="selection.splice(0)"
          >
            <Trash2 :size="16" /> Clear
          </button>
          <button class="primary" :disabled="!selection.length || !!progress" @click="exportAll">
            <Download :size="16" /> Export WAV
          </button>
        </div>
      </footer>
    </aside>
  </Transition>
</template>
