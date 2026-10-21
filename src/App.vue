<script setup lang="ts">
import { AudioLines, ImageIcon, ImageOffIcon, Library, Moon, RefreshCw, Sun } from "@lucide/vue";
import Player from "./components/Player.vue";
import SampleTray from "./components/SampleTray.vue";
import { flush, go, selection, showImages, state, theme } from "./store.ts";
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
      aria-label="Flush cache"
      title="Flush cache: refetch this game's characters and lines from the wiki"
      :disabled="state.flushing"
      @click="flush()"
    >
      <RefreshCw :class="{ spin: state.flushing }" :size="18" />
    </button>
    <button
      class="tray-btn"
      :aria-label="theme === 'dark' ? 'Light mode' : 'Dark mode'"
      @click="theme = theme === 'dark' ? 'light' : 'dark'"
    >
      <component :is="theme === 'dark' ? Sun : Moon" :size="18" />
    </button>
    <button
      class="tray-btn"
      :class="{ has: showImages }"
      :aria-pressed="showImages"
      :aria-label="showImages ? 'Hide images' : 'Show images'"
      @click="showImages = !showImages"
    >
      <component :is="showImages ? ImageIcon : ImageOffIcon" :size="18" />
    </button>
    <button
      class="tray-btn"
      :class="{ has: selection.length }"
      aria-label="Sample set"
      @click="state.trayOpen = !state.trayOpen"
    >
      <Library :size="18" />
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
