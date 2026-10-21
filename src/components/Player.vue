<script setup lang="ts">
import { LoaderCircle, Pause, Play, SkipBack, SkipForward, X } from "@lucide/vue";
import { onKeyStroke } from "@vueuse/core";
import { audioEl, currentTime, duration, playing, state, step, waiting } from "../store.ts";

const fmt = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "–:––";
const seek = (e: MouseEvent) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  currentTime.value = ((e.clientX - r.left) / r.width) * duration.value;
};
const close = () => (state.playing = null);

const typing = (e: KeyboardEvent) =>
  (e.target as HTMLElement).tagName === "INPUT" || !state.playing;
onKeyStroke(" ", (e) => !typing(e) && (e.preventDefault(), (playing.value = !playing.value)));
onKeyStroke(["ArrowDown", "j"], (e) => !typing(e) && (e.preventDefault(), step(1)));
onKeyStroke(["ArrowUp", "k"], (e) => !typing(e) && (e.preventDefault(), step(-1)));
</script>

<template>
  <Transition name="rise">
    <footer v-if="state.playing" class="player">
      <audio ref="audioEl" autoplay @error="waiting = false"></audio>
      <div class="track" @click="seek">
        <div
          class="fill"
          :style="{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }"
        ></div>
      </div>
      <div class="player-row">
        <div class="now">
          <strong>{{ state.playing.title }}</strong>
          <span>{{ state.playing.character }} · {{ state.playing.section }}</span>
        </div>
        <div class="controls">
          <button aria-label="Previous" @click="step(-1)"><SkipBack :size="18" /></button>
          <button class="main" :aria-label="playing ? 'Pause' : 'Play'" @click="playing = !playing">
            <LoaderCircle v-if="waiting" class="spin" :size="20" />
            <Pause v-else-if="playing" :size="20" />
            <Play v-else :size="20" />
          </button>
          <button aria-label="Next" @click="step(1)"><SkipForward :size="18" /></button>
        </div>
        <div class="time">
          <span>{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>
          <kbd title="Space: play/pause · ↑↓ or j/k: prev/next">⎵ ↑ ↓</kbd>
          <button aria-label="Close player" @click="close"><X :size="16" /></button>
        </div>
      </div>
    </footer>
  </Transition>
</template>
