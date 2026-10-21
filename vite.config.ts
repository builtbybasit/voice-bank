import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import devServer from "@hono/vite-dev-server";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

// Dev runs the API in Node so curate can shell out to `claude`; build and preview target Workers.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    vue(),
    command === "build" || isPreview
      ? cloudflare()
      : devServer({ entry: "server/index.ts", exclude: [/^(?!\/api\/).*/] }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
}));
