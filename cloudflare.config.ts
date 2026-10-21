import { bindings, defineConfig } from "cf/config";

try {
  process.loadEnvFile(); // .env holds CACHE_KV_ID; see .env.example
} catch {}
const kvId = process.env.CACHE_KV_ID;
// Without an id, cf deploy would provision a fresh namespace and drop the cache.
if (!kvId) throw new Error("Set CACHE_KV_ID in .env (cf kv namespaces list)");

// Static Vue build + the Hono API as one Worker. Export and curate stay in the browser / local `vp dev`.
export default defineConfig({
  worker: {
    name: "voicebank",
    entrypoint: "./server/index.ts",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
    env: { CACHE: bindings.kv({ id: kvId }) },
  },
});
