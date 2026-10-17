<script setup lang="ts">
import { AudioLines, Library } from "@lucide/vue";
import CharacterGrid from "./components/CharacterGrid.vue";
import CharacterView from "./components/CharacterView.vue";
import Player from "./components/Player.vue";
import SampleTray from "./components/SampleTray.vue";
import { state } from "./store.ts";

const go = (id: string) => {
  state.wiki = id;
  state.character = "";
};
</script>

<template>
  <header class="topbar">
    <a class="brand" href="#/" @click.prevent="state.character = ''"
      ><AudioLines :size="20" /> voicebank</a
    >
    <nav class="segmented" aria-label="Game">
      <button
        v-for="w in state.wikis"
        :key="w.id"
        :class="{ active: w.id === state.wiki }"
        :style="{ '--dot': w.accent }"
        @click="go(w.id)"
      >
        <i></i>{{ w.label }}
      </button>
    </nav>
    <button
      class="tray-btn"
      :class="{ has: state.selection.length }"
      @click="state.trayOpen = !state.trayOpen"
    >
      <Library :size="18" />
      <span>Sample set</span>
      <b v-if="state.selection.length">{{ state.selection.length }}</b>
    </button>
  </header>

  <main :class="{ 'with-player': state.playing }">
    <Transition name="page" mode="out-in">
      <CharacterView v-if="state.character" :key="state.wiki + state.character" />
      <CharacterGrid v-else :key="state.wiki" />
    </Transition>
  </main>

  <Player />
  <SampleTray />
</template>
