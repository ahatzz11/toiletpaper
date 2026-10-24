// Renders the share image and share video into public/media/ from scripts/share-media/scene.html,
// and the icon set (favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png) from
// public/icon.svg. Needs Google Chrome (driven by playwright-core), ffmpeg and ImageMagick. The
// output is committed, so this only runs when the scene or the icon changes:
//
//   npm run media

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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
const SECONDS = 8; // every animation in the scene repeats evenly in this time
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

  // Icons: Chrome draws the SVG at each size. The apple-touch icon is full-bleed because iOS
  // rounds the corners itself and would show transparent corners as black.
  const svg = await readFile(join(root, "public/icon.svg"), "utf8");
  const icon = async (size, out, square = false) => {
    const icons = await browser.newPage({ viewport: { width: size, height: size } });
    const markup = (square ? svg.replace(/rx="48"/, 'rx="0"') : svg).replace("<svg ", `<svg width="${size}" height="${size}" `);
    await icons.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
    await icons.screenshot({ path: out, omitBackground: true });
    await icons.close();
  };
  for (const size of [16, 32, 48]) await icon(size, join(frames, `ico${size}.png`));
  await icon(180, join(frames, "apple.png"), true);
  await icon(192, join(frames, "icon192.png"));
  await icon(512, join(frames, "icon512.png"));
  await browser.close();

  const squeeze = (from, to) => execFileSync("magick", [from, "-strip", "-define", "png:compression-level=9", to]);
  squeeze(join(frames, "apple.png"), join(root, "public/apple-touch-icon.png"));
  squeeze(join(frames, "icon192.png"), join(root, "public/icon-192.png"));
  squeeze(join(frames, "icon512.png"), join(root, "public/icon-512.png"));
  execFileSync("magick", [16, 32, 48].map((n) => join(frames, `ico${n}.png`)).concat(join(root, "public/favicon.ico")));

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
for (const f of [png, mp4, ...["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"].map((n) => join(root, "public", n))]) console.log(`${f}: ${(await stat(f)).size} bytes`);
