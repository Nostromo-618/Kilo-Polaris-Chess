import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const APP_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
).version;

// GitHub Pages serves this project at https://<user>.github.io/aurora-polaris-chess/.
// Override with VITE_BASE=/ (or a custom-domain root) when deploying elsewhere.
const BASE = process.env.VITE_BASE ?? "/aurora-polaris-chess/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // @vanduo-oss/vd3 is consumed via a pnpm `link:` to a sibling working tree
    // that carries its own Vue copy; dedupe so the app and the linked library
    // share a single Vue instance (avoids "invalid vnode type" / duplicate-Vue bugs).
    dedupe: ["vue"],
  },
  server: {
    fs: {
      // vd3 is linked from OUTSIDE this project root; its bundled CSS references
      // fonts/icons with relative url()s that resolve into ../../0_vanduo/vd3/dist.
      // The dev server's default fs.allow only covers the project root, so those
      // @fs requests 403 without this entry. Harmless once the dep flips to a
      // published version (assets then live under node_modules in the root).
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../../0_vanduo/vd3", import.meta.url)),
      ],
    },
  },
  build: {
    target: "es2020",
    // The GPL tomitank engine + the Aurora search stay discrete worker chunks
    // (bundled from `new Worker(new URL(...), import.meta.url)` in the engine layer).
    chunkSizeWarningLimit: 900,
  },
}));
