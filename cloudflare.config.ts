import { defineConfig } from "cf/config";

// Matches what is live: one Worker, "toiletpaper", on the Personal account. Its code is
// dist-inline/index.js, a single ES module with the whole site inlined. It has no
// bindings and no static-assets upload, and it sends www.toiletpaper.app to the apex itself.
//
// `npm run build:inline` writes dist-inline/index.js. Deploy it either by uploading that file
// as the Worker script through the Cloudflare API, or with `cf deploy`, which reads this file:
// vite.config.ts regenerates dist-inline/index.js first, then Vite bundles it as the
// entrypoint. See README.md.
export default defineConfig({
  worker: {
    name: "toiletpaper",
    compatibilityDate: "2026-10-01",
    entrypoint: "dist-inline/index.js",
    domains: ["toiletpaper.app", "www.toiletpaper.app"],
    workersDev: false,
  },
});
