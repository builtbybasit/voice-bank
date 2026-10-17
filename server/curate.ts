// Runs `claude -p` (Claude Code, billed to the user's subscription) instead of the API SDK.
import { execFile } from "node:child_process";
import { disk } from "./fandom.ts";

export type Verdict = { i: number; keep: boolean; emotion: string; text: string };
const EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "tender",
  "playful",
  "serious",
  "fearful",
  "surprised",
  "laugh",
  "shout",
  "whisper",
];
const SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          keep: { type: "boolean" },
          emotion: { type: "string", enum: EMOTIONS },
          text: { type: "string" },
        },
        required: ["i", "keep", "emotion", "text"],
      },
    },
  },
  required: ["lines"],
});
const SYSTEM = `You curate reference clips for voice cloning (XTTS, F5-TTS, Fish). You get a character's voice lines as "<i>: [<title>] <transcript>" and return one entry per line.
keep: true for roughly the best 15 lines (never more than 20%): a complete clean sentence of 6-30 words, spoken normally, no grunts, laughter-only, onomatopoeia, singing or shouting; together they should cover several emotions and both short and long sentences.
emotion: the delivery you would expect from the words and the title.
text: the transcript normalised for TTS training in the same language and script: remove stage directions in brackets, spell out numbers and symbols, fix spacing and punctuation, change nothing else.`;

const run = (lines: { title: string; text: string }[]) =>
  new Promise<Verdict[]>((res, rej) => {
    const p = execFile(
      "claude",
      [
        "-p",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--tools",
        "",
        "--output-format",
        "json",
        "--json-schema",
        SCHEMA,
        "--system-prompt",
        SYSTEM,
        "--model",
        process.env.CURATE_MODEL ?? "sonnet",
        "--effort",
        process.env.CURATE_EFFORT ?? "medium",
      ],
      { maxBuffer: 1 << 26, timeout: Number(process.env.CURATE_TIMEOUT ?? 600) * 1000 },
      (e, stdout) => {
        if (e) return rej(e);
        const r = JSON.parse(stdout);
        if (r.is_error) rej(new Error(r.result));
        else res(r.structured_output.lines);
      },
    );
    p.stdin!.end(lines.map((l, i) => `${i}: [${l.title}] ${l.text}`).join("\n"));
  });

/** Cached forever per character+language; delete data/cache/curate-*.json to redo. */
export const curate = (key: string, lines: { title: string; text: string }[]) =>
  disk(`curate-${key}`, () => run(lines), Infinity);
