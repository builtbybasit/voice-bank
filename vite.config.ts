import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import devServer from "@hono/vite-dev-server";

export default defineConfig({
  plugins: [vue(), devServer({ entry: "server/index.ts", exclude: [/^(?!\/api\/).*/] })],
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
