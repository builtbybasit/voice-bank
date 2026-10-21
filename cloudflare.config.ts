import { defineConfig } from "cf/config";

// Static Vue build + the Hono API as one Worker. Export and curate stay in the browser / local `vp dev`.
export default defineConfig({
  worker: {
    name: "voicebank",
    entrypoint: "./server/index.ts",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
  },
});
