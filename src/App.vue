<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Search, Download, Mic } from "@lucide/vue";

type Wiki = { id: string; label: string };
type Line = { title: string; url: string; text: string };

const wikis = ref<Wiki[]>([]);
const wiki = ref("");
const characters = ref<string[]>([]);
const query = ref("");
const character = ref("");
const lines = ref<Line[]>([]);
const loading = ref(false);
const status = ref("");

const filtered = computed(() =>
  characters.value.filter((n) => n.toLowerCase().includes(query.value.toLowerCase())),
);
const get = (url: string) => fetch(url).then((r) => r.json());

get("/api/wikis").then((w) => {
  wikis.value = w;
  wiki.value = w[0].id;
});

watch(wiki, async (w) => {
  character.value = "";
  lines.value = [];
  characters.value = [];
  characters.value = await get(`/api/${w}/characters`);
});

watch(character, async (name) => {
  if (!name) return;
  loading.value = true;
  lines.value = [];
  lines.value = await get(`/api/${wiki.value}/${encodeURIComponent(name)}/lines`);
  loading.value = false;
});

async function download() {
  status.value = `Downloading ${lines.value.length} clips…`;
  const r = await fetch(`/api/${wiki.value}/${encodeURIComponent(character.value)}/download`, {
    method: "POST",
  }).then((r) => r.json());
  status.value = `${r.done}/${r.total} clips in ${r.dir}`;
}
</script>

<template>
  <aside>
    <h1><Mic :size="18" /> voicebank</h1>
    <nav class="tabs">
      <button
        v-for="w in wikis"
        :key="w.id"
        :class="{ active: w.id === wiki }"
        @click="wiki = w.id"
      >
        {{ w.label }}
      </button>
    </nav>
    <label class="search"
      ><Search :size="16" /><input v-model="query" placeholder="Search characters"
    /></label>
    <ul class="list">
      <li
        v-for="n in filtered"
        :key="n"
        :class="{ active: n === character }"
        @click="character = n"
      >
        {{ n }}
      </li>
      <li v-if="!characters.length" class="muted">Loading…</li>
    </ul>
  </aside>

  <main>
    <header v-if="character">
      <h2>{{ character }}</h2>
      <span class="muted">{{ lines.length }} lines</span>
      <button class="primary" :disabled="!lines.length" @click="download">
        <Download :size="16" /> Download as WAV
      </button>
      <span class="muted">{{ status }}</span>
    </header>
    <p v-else class="muted empty">Pick a character.</p>
    <p v-if="loading" class="muted empty">Loading lines…</p>

    <article v-for="l in lines" :key="l.url">
      <audio
        :src="`/api/${wiki}/audio?u=${encodeURIComponent(l.url)}`"
        controls
        preload="none"
      ></audio>
      <div>
        <strong>{{ l.title }}</strong>
        <p>{{ l.text }}</p>
      </div>
    </article>
  </main>
</template>
