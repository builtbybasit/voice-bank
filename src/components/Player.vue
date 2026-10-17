<script setup lang="ts">
import { Pause, Play, SkipBack, SkipForward, X } from "@lucide/vue";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { media, state, step } from "../store.ts";

const audio = ref<HTMLAudioElement>();
const t = ref(0);
const d = ref(0);
const fmt = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "–:––";

watch(
  () => state.playing?.url,
  (url) => {
    if (!audio.value || !url) return;
    audio.value.src = media(state.playing!.wiki, url);
    audio.value.play().catch(() => (state.paused = true));
  },
  { flush: "post" },
);
watch(
  () => state.paused,
  (p) => (p ? audio.value?.pause() : audio.value?.play().catch(() => (state.paused = true))),
  { flush: "post" },
);

const seek = (e: MouseEvent) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  if (audio.value && d.value) audio.value.currentTime = ((e.clientX - r.left) / r.width) * d.value;
};
const close = () => {
  state.paused = true;
  state.playing = null;
};
const keys = (e: KeyboardEvent) => {
  if ((e.target as HTMLElement).tagName === "INPUT" || !state.playing) return;
  const act = {
    Space: () => (state.paused = !state.paused),
    ArrowDown: () => step(1),
    j: () => step(1),
    ArrowUp: () => step(-1),
    k: () => step(-1),
  }[e.code === "Space" ? "Space" : e.key];
  if (act) {
    e.preventDefault();
    act();
  }
};
onMounted(() => window.addEventListener("keydown", keys));
onUnmounted(() => window.removeEventListener("keydown", keys));
</script>

<template>
  <Transition name="rise">
    <footer v-if="state.playing" class="player">
      <audio
        ref="audio"
        @timeupdate="t = ($event.target as HTMLAudioElement).currentTime"
        @loadedmetadata="d = ($event.target as HTMLAudioElement).duration"
        @ended="step(1)"
        @pause="state.paused = true"
        @play="state.paused = false"
      ></audio>
      <div class="track" @click="seek">
        <div class="fill" :style="{ width: d ? `${(t / d) * 100}%` : '0%' }"></div>
      </div>
      <div class="player-row">
        <div class="now">
          <strong>{{ state.playing.title }}</strong>
          <span>{{ state.playing.character }} · {{ state.playing.section }}</span>
        </div>
        <div class="controls">
          <button aria-label="Previous" @click="step(-1)"><SkipBack :size="18" /></button>
          <button
            class="main"
            :aria-label="state.paused ? 'Play' : 'Pause'"
            @click="state.paused = !state.paused"
          >
            <Play v-if="state.paused" :size="20" />
            <Pause v-else :size="20" />
          </button>
          <button aria-label="Next" @click="step(1)"><SkipForward :size="18" /></button>
        </div>
        <div class="time">
          <span>{{ fmt(t) }} / {{ fmt(d) }}</span>
          <kbd title="Space: play/pause · ↑↓ or j/k: prev/next">⎵ ↑ ↓</kbd>
          <button aria-label="Close player" @click="close"><X :size="16" /></button>
        </div>
      </div>
    </footer>
  </Transition>
</template>
