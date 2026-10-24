import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// The Worker entrypoint is dist-inline/index.js, which already contains every file in public/.
// Rebuild it before Vite loads it, and turn off publicDir so Vite does not emit those files a
// second time as static assets.
execFileSync(process.execPath, ["scripts/build-inline.mjs"], { stdio: "inherit" });

export default defineConfig({ publicDir: false, plugins: [cloudflare()] });
