<script setup lang="ts">
import { Search } from "@lucide/vue";
import { computed, ref } from "vue";
import { portrait, state, wiki } from "../store.ts";

const query = ref("");
const list = computed(() => state.characters[state.wiki]);
const filtered = computed(() =>
  (list.value ?? []).filter((c) => c.name.toLowerCase().includes(query.value.trim().toLowerCase())),
);
</script>

<template>
  <section class="grid-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ wiki()?.label }}</p>
        <h1>Pick a <em>voice</em></h1>
      </div>
      <label class="search">
        <Search :size="18" />
        <input v-model="query" placeholder="Search characters" autofocus />
        <kbd v-if="!query">{{ list?.length ?? "…" }}</kbd>
      </label>
    </div>

    <div v-if="!list" class="cards">
      <div v-for="n in 18" :key="n" class="card skeleton"></div>
    </div>
    <p v-else-if="!filtered.length" class="empty">No character matches “{{ query }}”.</p>
    <div v-else class="cards">
      <button
        v-for="c in filtered"
        :key="c.name"
        class="card"
        :style="{ '--i': filtered.indexOf(c) }"
        @click="state.character = c.name"
      >
        <img
          v-if="c.image"
          :src="portrait(c)"
          :alt="c.name"
          loading="lazy"
          decoding="async"
          @error="c.image = null"
        />
        <span v-else class="placeholder">{{ c.name[0] }}</span>
        <span class="name">{{ c.name }}</span>
      </button>
    </div>
  </section>
</template>
