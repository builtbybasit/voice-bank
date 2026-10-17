<script setup lang="ts">
import { Download, Trash2, X } from "@lucide/vue";
import { computed, ref } from "vue";
import { LANG_LABEL, state, type Item } from "../store.ts";

const groups = computed(() => {
  const m = new Map<string, Item[]>();
  for (const i of state.selection) {
    const k = `${i.wiki}/${i.character}/${i.lang}`;
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return [...m.values()];
});
const remove = (i: Item) => state.selection.splice(state.selection.indexOf(i), 1);
const label = (id: string) => state.wikis.find((w) => w.id === id)?.label ?? id;

const progress = ref<{ done: number; total: number; file?: string } | null>(null);
const result = ref("");

async function exportAll() {
  progress.value = { done: 0, total: state.selection.length };
  result.value = "";
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: state.selection }),
  });
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    for (const msg of buf.split("\n\n").slice(0, -1)) {
      const data = msg.match(/^data: (.*)$/m)?.[1];
      if (data) progress.value = JSON.parse(data);
    }
    buf = buf.slice(buf.lastIndexOf("\n\n") + 2);
  }
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
          <p class="muted">{{ state.selection.length }} clips · 24 kHz mono WAV + metadata.jsonl</p>
        </div>
        <button class="icon" aria-label="Close" @click="state.trayOpen = false">
          <X :size="18" />
        </button>
      </header>

      <div class="tray-body">
        <p v-if="!state.selection.length" class="empty">
          Nothing yet. Add lines with <b>+</b> or “Add all to sample set”.
        </p>
        <section v-for="g in groups" :key="g[0].wiki + g[0].character + g[0].lang">
          <h3>
            {{ g[0].character }}
            <small>{{ label(g[0].wiki) }} · {{ LANG_LABEL[g[0].lang] }} · {{ g.length }}</small>
          </h3>
          <ul>
            <li v-for="i in g" :key="i.url">
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
            :disabled="!state.selection.length || !!progress"
            @click="state.selection.splice(0)"
          >
            <Trash2 :size="16" /> Clear
          </button>
          <button
            class="primary"
            :disabled="!state.selection.length || !!progress"
            @click="exportAll"
          >
            <Download :size="16" /> Export WAV
          </button>
        </div>
      </footer>
    </aside>
  </Transition>
</template>
