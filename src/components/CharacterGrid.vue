<script setup lang="ts">
import { Search } from "@lucide/vue";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { go, portrait, state, wiki } from "../store.ts";

const GENDERS = [
  ["", "All"],
  ["f", "Female"],
  ["m", "Male"],
] as const;
const query = ref("");
const gender = useLocalStorage("voicebank:gender", "");
const list = computed(() => state.characters[state.wiki]);
const filtered = computed(() =>
  (list.value ?? []).filter(
    (c) =>
      (!gender.value || c.gender === gender.value) &&
      c.name.toLowerCase().includes(query.value.trim().toLowerCase()),
  ),
);
</script>

<template>
  <section class="grid-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ wiki()?.label }}</p>
        <h1>Pick a <em>voice</em></h1>
      </div>
      <div class="tools">
        <nav class="segmented" aria-label="Gender">
          <button
            v-for="[id, label] in GENDERS"
            :key="id"
            :class="{ active: gender === id }"
            @click="gender = id"
          >
            {{ label }}
          </button>
        </nav>
        <label class="search">
          <Search :size="18" />
          <input v-model="query" placeholder="Search characters" autofocus />
          <kbd v-if="list">{{ filtered.length }}</kbd>
        </label>
      </div>
    </div>

    <div v-if="!list" class="cards">
      <div v-for="n in 18" :key="n" class="card skeleton"></div>
    </div>
    <p v-else-if="!filtered.length" class="empty">No character matches.</p>
    <div v-else class="cards">
      <button
        v-for="(c, i) in filtered"
        :key="c.name"
        class="card"
        :style="{ '--i': i }"
        @click="go(state.wiki, c.name)"
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
