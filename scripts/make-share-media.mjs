// Renders the share image and share video into public/media/ from scripts/share-media/scene.html.
// Needs Google Chrome (driven by playwright-core) and ffmpeg. The output is committed, so this only
// runs when the scene changes:
//
//   npm run media

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const scene = pathToFileURL(join(root, "scripts/share-media/scene.html")).href;
const png = join(root, "public/media/share.png");
const mp4 = join(root, "public/media/share.mp4");
const WIDTH = 1200;
const HEIGHT = 630;
const SECONDS = 6; // every animation in the scene repeats evenly in this time
const FPS = 24;

const frames = await mkdtemp(join(tmpdir(), "tp-share-"));
try {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.goto(scene, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const count = await page.evaluate(() => {
    const all = document.getAnimations();
    for (const a of all) a.pause();
    return all.length;
  });
  if (count === 0) throw new Error("the scene has no animations");
  for (let i = 0; i < SECONDS * FPS; i++) {
    await page.evaluate((ms) => { for (const a of document.getAnimations()) a.currentTime = ms; }, (i * 1000) / FPS);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.png`) });
  }
  await browser.close();

  // Frame 0 is the share image: 256 colors is plenty for flat shapes and keeps it small.
  execFileSync("magick", [join(frames, "f0000.png"), "-strip", "-colors", "256", "-define", "png:compression-level=9", "-define", "png:compression-filter=5", png]);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "f%04d.png"),
    "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-crf", "30", "-profile:v", "high",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4,
  ]);
} finally {
  await rm(frames, { recursive: true, force: true });
}
for (const f of [png, mp4]) console.log(`${f}: ${(await stat(f)).size} bytes`);
