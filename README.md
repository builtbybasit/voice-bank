# voicebank

Collect voice samples for voice cloning from game character voice-overs on Fandom wikis. Browse characters by portrait, listen to transcribed lines, pick the ones you want, and export them as 24 kHz mono WAV with a `metadata.jsonl` that XTTS, F5-TTS, Fish and GPT-SoVITS can ingest directly.

Supported wikis: Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves. English, Japanese, Chinese and Korean lines where the wiki has them (ZZZ is English only).

## Run

Requires [Vite+](https://viteplus.dev) (`vp`) and `ffmpeg` on PATH.

```sh
vp install
vp dev
```

Open http://localhost:5173. `vp check --fix` formats, lints and type checks.

## Use

1. Pick a game in the top bar, then a character from the grid. The All/Female/Male toggle filters the grid and is remembered.
2. Click a line to play it. Space pauses, `j`/`k` or arrow keys step through lines.
3. Add lines with `+`, a whole section with "Select section", or everything with "Add all to sample set".
4. Open "Sample set" and press "Export WAV".

Exports land in `data/{game}/{Character}/{lang}/` as `{title}-{hash}.wav` plus `metadata.jsonl`, one JSON object per line:

```json
{
  "audio": "data/genshin/Furina/en/Hello-0214bdbc.wav",
  "text": "Why are you just standing there...",
  "title": "Hello",
  "character": "Furina",
  "game": "genshin",
  "lang": "en"
}
```

Clips already on disk are skipped, so re-exporting a larger selection only fetches the new ones. The selection itself is kept in `localStorage`.

## How it works

- **Server** (`server/`, Hono, runs inside the Vite dev server): talks to each wiki's MediaWiki `api.php`, parses the rendered voice-over page with cheerio, proxies audio and portraits from the Fandom CDN (which needs a `Referer` from the wiki), and converts clips with `ffmpeg`.
- **UI** (`src/`, Vue 3): vue-router for `#/{game}/{Character}?lang=ja`, VueUse for the audio controls and persisted selection, lucide icons.
- **Gender** comes from wiki categories (Genshin, ZZZ, WuWa). Honkai: Star Rail has none, so it is inferred from pronoun counts on the character's Lore page; a few characters (Trailblazer, Anaxa) stay unclassified and only show under "All".
- **Caches**: character rosters are stored in `data/cache/characters-{game}.json` for 24 hours. Delete a file to refetch sooner, for example after a new character releases. Voice lines are cached in memory for the server's lifetime.

Lines without a transcript on the wiki, such as combat grunts, are dropped.

## Notes

Voice clips are copyright of HoYoverse and Kuro Games. This tool is for personal experiments; do not ship cloned voices commercially.
