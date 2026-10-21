# voicebank

Collect voice samples for voice cloning from game character voice-overs on Fandom wikis. Browse characters by portrait, listen to transcribed lines, pick the ones you want, and export them as 24 kHz mono WAV with a `metadata.jsonl` that XTTS, F5-TTS, Fish and GPT-SoVITS can ingest directly.

Supported wikis: Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves. English, Japanese, Chinese and Korean lines where the wiki has them (ZZZ is English only).

## Run

Requires [Vite+](https://viteplus.dev) (`vp`).

```sh
vp install
vp dev
```

Open http://localhost:5173. `vp check --fix` formats, lints and type checks.

## Deploy

Deploys to Cloudflare Workers with the [`cf` CLI](https://developers.cloudflare.com/cf/) (Node 22.18+, not Bun):

```sh
cf auth login
cf kv namespaces create --title voicebank-cache   # once; put its id in .env as CACHE_KV_ID
vp run deploy
```

`vp preview` runs the production build locally in workerd. "Curate with Claude" is local only: it shells out to the `claude` CLI, so builds hide the button.

## Use

1. Pick a game in the top bar, then a character from the grid. The All/Female/Male toggle filters the grid and is remembered.
2. Click a line to play it. Space pauses, `j`/`k` or arrow keys step through lines.
3. Add lines with `+`, a whole section with "Select section", or everything with "Add all to sample set".
4. Optional: "Curate with Claude" asks Claude to tag every line with an emotion, clean the transcript for TTS, and pick the best 10-15 clips. The button then adds those picks to the set in one click.
5. Open "Sample set" and press "Export WAV". The browser converts the clips and downloads `voicebank.zip`.

Unzip it in the project root: clips land in `data/{game}/{Character}/{lang}/` as `{title}-{hash}.wav` plus `metadata.jsonl`, one JSON object per line:

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

Each export zips the whole selection, so unzipping over an earlier export replaces its `metadata.jsonl` files. Decoding the wiki's Ogg clips needs Chrome or Firefox; Safari may fail. The selection itself is kept in `localStorage`.

## How it works

- **Server** (`server/`, Hono, runs inside the Vite dev server locally and as the Worker in production): talks to each wiki's MediaWiki `api.php`, parses the rendered voice-over page with cheerio, proxies audio and portraits from the Fandom CDN (which needs a `Referer` from the wiki). The UI converts clips to WAV with Web Audio and zips them with fflate.
- **UI** (`src/`, Vue 3): vue-router for `#/{game}/{Character}?lang=ja`, VueUse for the audio controls and persisted selection, lucide icons.
- **Curation** runs `claude -p --json-schema` from the server, so it uses your Claude Code login and subscription rather than API credits. Requires Claude Code installed and logged in. Verdicts are cached forever in `data/cache/curate-*.json`; delete one to redo a character. Model, effort and timeout come from `.env` (copy `.env.example`).
- **Gender** comes from wiki categories (Genshin, ZZZ, WuWa). Honkai: Star Rail has none, so it is inferred from pronoun counts on the character's Lore page; a few characters (Trailblazer, Anaxa) stay unclassified and only show under "All".
- **Caches**: character rosters are stored in `data/cache/characters-{game}.json` for 24 hours. Delete a file to refetch sooner, for example after a new character releases. Voice lines are cached in memory for the server's lifetime. On Workers, rosters go to the `CACHE` KV namespace instead (same 24 hours; `cf kv keys delete` to refetch) and voice lines live in each isolate's memory.

Lines without a transcript on the wiki, such as combat grunts, are dropped.

## Notes

Voice clips are copyright of HoYoverse and Kuro Games. This tool is for personal experiments; do not ship cloned voices commercially.
