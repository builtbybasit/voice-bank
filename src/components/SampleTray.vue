<script setup lang="ts">
import { Download, FolderOpen, Pause, Play, Trash2, X } from "@lucide/vue";
import { useLocalStorage } from "@vueuse/core";
import { createParser } from "eventsource-parser";
import { computed, ref } from "vue";
import { LANG_LABEL, play, playing, selection, state, type Item } from "../store.ts";

const groups = computed(() =>
  Map.groupBy(selection.value, (i) => `${i.wiki}/${i.character}/${i.lang}`)
    .values()
    .toArray(),
);
const remove = (i: Item) => selection.value.splice(selection.value.indexOf(i), 1);
const label = (id: string) => state.wikis.find((w) => w.id === id)?.label ?? id;

const progress = ref<{ done: number; total: number; file?: string; url?: string } | null>(null);
const result = ref("");
/** Exported WAV path per clip url, so each exported row can reveal its file. */
const exported = useLocalStorage<Record<string, string>>("voicebank:exported", {});
const reveal = (file: string) =>
  fetch("/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file }),
  });

async function exportAll() {
  progress.value = { done: 0, total: selection.value.length };
  result.value = "";
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: selection.value }),
  });
  const parser = createParser({
    onEvent: (e) => {
      progress.value = JSON.parse(e.data);
      const { url, file } = progress.value ?? {};
      if (url && file) exported.value[url] = file;
    },
  });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) parser.feed(r.value);
  result.value = `${progress.value?.done} WAV files + metadata.jsonl written under data/`;
  progress.value = null;
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
                <Pause v-if="state.playing?.url === i.url && playing" :size="14" />
                <Play v-else :size="14" />
              </button>
              <span
                ><b>{{ i.title }}</b
                ><small>{{ i.text }}</small></span
              >
              <button
                v-if="exported[i.url]"
                class="icon reveal"
                aria-label="Show in folder"
                @click="reveal(exported[i.url])"
              >
                <FolderOpen :size="14" />
              </button>
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
