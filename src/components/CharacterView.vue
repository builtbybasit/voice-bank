<script setup lang="ts">
import { ArrowLeft, Check, CheckCheck, Pause, Play, Plus, Sparkles } from "@lucide/vue";
import { computed } from "vue";
import {
  LANG_LABEL,
  curate,
  go,
  isSelected,
  picks,
  play,
  playing,
  portrait,
  showImages,
  state,
  toggle,
  wiki,
  type Line,
} from "../store.ts";

const me = computed(() => state.characters[state.wiki]?.find((c) => c.name === state.character));
const sections = computed(() => {
  const m = new Map<string, Line[]>();
  for (const l of state.lines) m.set(l.section, [...(m.get(l.section) ?? []), l]);
  return [...m].map(([name, lines]) => ({ name, lines, id: name.replace(/\W+/g, "-") }));
});
const allSelected = (lines: Line[]) => lines.every((l) => isSelected(l.url));
const toggleAll = (lines: Line[]) => {
  const add = !allSelected(lines);
  for (const l of lines) if (isSelected(l.url) !== add) toggle(l);
};
const isPlaying = (l: Line) => state.playing?.url === l.url && playing.value;
const jump = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
</script>

<template>
  <article class="character">
    <div
      class="hero"
      :style="showImages && me?.image ? { '--bg': `url(${portrait(me, 800)})` } : {}"
    >
      <div class="hero-body">
        <button class="back" @click="go(state.wiki)">
          <ArrowLeft :size="16" /> {{ wiki()?.label }}
        </button>
        <h1>{{ state.character }}</h1>
        <p class="meta">
          <span v-if="state.loading">Loading lines…</span>
          <span v-else
            >{{ state.lines.length }} transcribed lines · {{ sections.length }} sections</span
          >
        </p>
        <div v-if="(wiki()?.langs.length ?? 0) > 1" class="langs">
          <button
            v-for="l in wiki()?.langs"
            :key="l"
            :class="{ active: l === state.lang }"
            @click="go(state.wiki, state.character, l)"
          >
            {{ LANG_LABEL[l] }}
          </button>
        </div>
        <div class="hero-actions">
          <button class="primary" :disabled="!state.lines.length" @click="toggleAll(state.lines)">
            <CheckCheck :size="16" />
            {{
              state.lines.length && allSelected(state.lines)
                ? "Remove all from set"
                : "Add all to sample set"
            }}
          </button>
          <button class="ghost" :disabled="!state.lines.length" @click="play(state.lines[0])">
            <Play :size="16" /> Play from top
          </button>
          <button
            v-if="!picks().length"
            class="ghost"
            :disabled="!state.lines.length || state.curating"
            @click="curate()"
          >
            <Sparkles :size="16" /> {{ state.curating ? "Asking Claude…" : "Curate with Claude" }}
          </button>
          <button v-else class="ghost" @click="toggleAll(picks())">
            <Sparkles :size="16" />
            {{
              allSelected(picks()) ? "Remove picks from set" : `Add ${picks().length} picks to set`
            }}
          </button>
        </div>
      </div>
      <img
        v-if="showImages && me?.image"
        class="hero-portrait"
        :src="portrait(me, 800)"
        :alt="state.character"
      />
    </div>

    <nav v-if="sections.length > 1" class="section-nav">
      <a v-for="s in sections" :key="s.id" :href="`#${s.id}`" @click.prevent="jump(s.id)"
        >{{ s.name }} <small>{{ s.lines.length }}</small></a
      >
    </nav>

    <div v-if="state.loading" class="lines">
      <div v-for="n in 8" :key="n" class="line skeleton"></div>
    </div>
    <p v-else-if="!state.lines.length" class="empty">
      No transcribed lines in {{ LANG_LABEL[state.lang] }} for this character.
    </p>

    <section v-for="s in sections" :id="s.id" :key="s.name" class="section">
      <header>
        <h2>{{ s.name }}</h2>
        <button class="ghost small" @click="toggleAll(s.lines)">
          <component :is="allSelected(s.lines) ? Check : Plus" :size="14" />
          {{ allSelected(s.lines) ? "Selected" : "Select section" }}
        </button>
      </header>
      <div class="lines">
        <div
          v-for="l in s.lines"
          :key="l.url"
          class="line"
          :class="{
            playing: state.playing?.url === l.url,
            selected: isSelected(l.url),
            keep: state.curated[l.url]?.keep,
          }"
          @click="play(l)"
        >
          <button class="play" :aria-label="isPlaying(l) ? 'Pause' : 'Play'" @click.stop="play(l)">
            <Pause v-if="isPlaying(l)" :size="16" />
            <Play v-else :size="16" />
          </button>
          <div class="body">
            <strong
              >{{ l.title }}
              <em v-if="state.curated[l.url]" class="tag">
                <Sparkles v-if="state.curated[l.url].keep" :size="10" />
                {{ state.curated[l.url].emotion }}</em
              ></strong
            >
            <p>{{ l.text }}</p>
          </div>
          <button
            class="pick"
            :aria-pressed="isSelected(l.url)"
            :aria-label="isSelected(l.url) ? 'Remove from sample set' : 'Add to sample set'"
            @click.stop="toggle(l)"
          >
            <Check v-if="isSelected(l.url)" :size="14" />
            <Plus v-else :size="14" />
          </button>
        </div>
      </div>
    </section>
  </article>
</template>
