<script setup lang="ts">
import { AudioLines, Library } from "@lucide/vue";
import Player from "./components/Player.vue";
import SampleTray from "./components/SampleTray.vue";
import { go, selection, state } from "./store.ts";
</script>

<template>
  <header class="topbar">
    <RouterLink class="brand" :to="`/${state.wiki}`"
      ><AudioLines :size="20" /> voicebank</RouterLink
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
      :class="{ has: selection.length }"
      @click="state.trayOpen = !state.trayOpen"
    >
      <Library :size="18" />
      <span>Sample set</span>
      <b v-if="selection.length">{{ selection.length }}</b>
    </button>
  </header>

  <main :class="{ 'with-player': state.playing }">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="state.wiki + state.character" />
      </Transition>
    </RouterView>
  </main>

  <Player />
  <SampleTray />
</template>
