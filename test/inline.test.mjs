import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import worker from "../dist-inline/index.js";

const get = (path, init = {}, host = "toiletpaper.app") => worker.fetch(new Request(`https://${host}${path}`, init));
const pub = (file) => readFile(new URL(`../public/${file}`, import.meta.url), "utf8");
const pick = (html, re) => (re.exec(html) || [])[1];
const pubBytes = (file) => readFile(new URL(`../public/${file}`, import.meta.url));
const meta = (html, key) => pick(html, new RegExp(`<meta (?:property|name)="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)">`));
const hash10 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 10);
const assetRefs = (html) => [...html.matchAll(/\s(?:href|src)="([^"]*\.(?:css|m?js))"/g)].map((m) => m[1]);
const IMMUTABLE = "public, max-age=31536000, immutable";
const ASSETS = [
  { file: "styles.css", type: "text/css; charset=utf-8" },
  { file: "data.js", type: "text/javascript; charset=utf-8" },
  { file: "core.js", type: "text/javascript; charset=utf-8" },
  { file: "app.js", type: "text/javascript; charset=utf-8" },
];

const PAGES = [
  { path: "/", title: "Which toilet paper pack is the better deal? | Toilet Paper Math" },
  { path: "/convert", title: "Roll converter: what Mega, Mega XL and Super Mega really mean | Toilet Paper Math" },
  { path: "/softness", title: "Softness scale: which toilet paper is softest? | Toilet Paper Math" },
  { path: "/about", title: "How it works: why sheets beat rolls | Toilet Paper Math" },
  { path: "/data", title: "Data &amp; API: every roll, its sources and a JSON API | Toilet Paper Math" },
];
const GUIDES = [
  { path: "/charmin-mega-vs-quilted-northern-mega" },
  { path: "/how-many-sheets-in-a-mega-roll" },
  { path: "/cheapest-toilet-paper-per-sheet" },
];

for (const page of PAGES) {
  test(`${page.path} returns 200 with its own title and meta tags`, async () => {
    const res = await get(page.path);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.ok(res.headers.get("etag"));
    const html = await res.text();
    assert.equal(pick(html, /<title>([^<]*)<\/title>/), page.title);
    const url = `https://toiletpaper.app${page.path}`;
    assert.equal(pick(html, /<link rel="canonical" href="([^"]*)">/), url);
    assert.equal(pick(html, /<meta property="og:url" content="([^"]*)">/), url);
    assert.ok(pick(html, /<meta name="description" content="([^"]+)">/));
    assert.ok(pick(html, /<meta property="og:title" content="([^"]+)">/));
    assert.ok(pick(html, /<meta property="og:description" content="([^"]+)">/));
    // Every page links to every tab in the nav, in order, and marks itself as current.
    const nav = pick(html, /<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]), PAGES.map((p) => p.path), page.path);
    assert.deepEqual([...nav.matchAll(/<a href="([^"]+)" aria-current="page"[ >]/g)].map((m) => m[1]), [page.path]);
  });
}

test("trailing-slash routes 301 to the clean path", async () => {
  const cases = [["/convert/", "/convert"], ["/about/?x=1", "/about?x=1"], ["/about//", "/about"], [GUIDES[0].path + "/", GUIDES[0].path]];
  for (const [path, location] of cases) {
    const res = await get(path);
    assert.equal(res.status, 301, path);
    assert.equal(res.headers.get("location"), location, path);
  }
  // Leading slashes collapse, so this can't redirect to another site.
  const res = await get("//evil.example/");
  assert.notEqual(res.headers.get("location"), "//evil.example");
  assert.equal(res.status, 404);
});

test("sheet count is the default comparison on both tools", async () => {
  const deal = await (await get("/")).text();
  assert.match(deal, /<input type="radio" name="judge" value="sheets" autocomplete="off" checked>/);
  assert.doesNotMatch(deal, /name="judge" value="(area|areaply)" checked/);
  const convert = await (await get("/convert")).text();
  assert.match(convert, /<input type="radio" name="conv-mode" value="sheets" autocomplete="off" checked>/);
  assert.doesNotMatch(convert, /name="conv-mode" value="(area|areaply)" checked/);
});

const HTML_PAGES = [...PAGES, ...GUIDES, { path: "/nope" }];

test("every page references only content-hashed CSS and JS, in the source order", async () => {
  for (const page of HTML_PAGES) {
    const html = await (await get(page.path)).text();
    const expected = ASSETS.map(async (a) => `/${a.file.replace(/\.(css|js)$/, `.${hash10(await pub(a.file))}.$1`)}`);
    const refs = assetRefs(html);
    assert.deepEqual(refs, await Promise.all(expected), page.path);
    // Nothing still points at a plain /styles.css, /app.js, /core.js or /data.js.
    for (const a of ASSETS) assert.ok(!html.includes(`"/${a.file}"`), `${page.path} still references /${a.file}`);
  }
});

test("hashed CSS and JS return 200 with an immutable cache header and their type", async () => {
  const refs = assetRefs(await (await get("/")).text());
  assert.equal(refs.length, ASSETS.length);
  for (const path of refs) {
    const asset = ASSETS.find((a) => path.startsWith(`/${a.file.split(".")[0]}.`));
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("content-type"), asset.type, path);
    assert.equal(res.headers.get("cache-control"), IMMUTABLE, path);
    const body = await res.text();
    assert.equal(body, await pub(asset.file), path);
    // The hash in the URL is the hash of what it serves.
    assert.equal(path.split(".").at(-2), hash10(body), path);
  }
});

test("plain and out-of-date asset paths serve the current file with no-cache", async () => {
  for (const a of ASSETS) {
    const [name, ext] = a.file.split(".");
    for (const path of [`/${a.file}`, `/${name}.0123456789.${ext}`]) {
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get("content-type"), a.type, path);
      assert.equal(res.headers.get("cache-control"), "no-cache", path);
      assert.equal(await res.text(), await pub(a.file), path);
    }
  }
});

test("changing a file changes its hashed URL", async () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), "tp-build-"));
  try {
    for (const sub of ["public", "scripts", "src"]) await cp(join(root, sub), join(dir, sub), { recursive: true });
    await appendFile(join(dir, "public", "styles.css"), "\n/* changed */\n");
    execFileSync(process.execPath, [join(dir, "scripts", "build-inline.mjs")], { stdio: "ignore" });
    const { default: changed } = await import(join(dir, "dist-inline", "index.js"));
    const refsOf = async (w) => assetRefs(await (await w.fetch(new Request("https://toiletpaper.app/"))).text());
    const [before, after] = [await refsOf(worker), await refsOf(changed)];
    assert.notEqual(after[0], before[0], "styles.css hash should change");
    assert.match(after[0], /^\/styles\.[0-9a-f]{10}\.css$/);
    assert.deepEqual(after.slice(1), before.slice(1), "unchanged JS keeps its hash");
    const res = await changed.fetch(new Request(`https://toiletpaper.app${after[0]}`));
    assert.match(await res.text(), /\/\* changed \*\/\n$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("every page sizes the mascot and has fallback header styles without styles.css", async () => {
  let fallback;
  for (const page of HTML_PAGES) {
    const html = await (await get(page.path)).text();
    assert.match(html, /<svg class="mascot" width="58" height="63" viewBox="60 40 240 260"/, page.path);
    const style = pick(html, /<style>([\s\S]*?)<\/style>/);
    assert.ok(style, `${page.path} has an inline <style>`);
    assert.match(style, /:where\(\.mascot\) \{ width: 58px; height: 63px;/);
    assert.match(style, /:where\(\.site-nav\), :where\(\.nav-tabs\) \{ display: flex;/);
    assert.ok(html.indexOf("<style>") < html.indexOf('<link rel="stylesheet"'), `${page.path}: inline style comes before the stylesheet`);
    fallback ??= style;
    assert.equal(style, fallback, `${page.path} has the same fallback styles as the other pages`);
  }
  // The background rolls built from core.js carry their own size too.
  assert.match(await pub("core.js"), /<svg class="spool" width="48" height="48" viewBox="0 0 48 48"/);
});

const MEDIA = [
  { key: "og:image", file: "media/share.png", type: "image/png" },
  { key: "og:video", file: "media/share.mp4", type: "video/mp4" },
];

test("every page has share image and video tags with absolute hashed URLs", async () => {
  const urls = {};
  for (const m of MEDIA) {
    const [name, ext] = m.file.split(".");
    urls[m.key] = `https://toiletpaper.app/${name}.${hash10(await pubBytes(m.file))}.${ext}`;
  }
  for (const page of HTML_PAGES) {
    const html = await (await get(page.path)).text();
    const tag = (key) => meta(html, key);
    assert.equal(tag("og:image"), urls["og:image"], page.path);
    assert.equal(tag("og:image:type"), "image/png", page.path);
    assert.equal(tag("og:image:width"), "1200", page.path);
    assert.equal(tag("og:image:height"), "630", page.path);
    assert.ok(tag("og:image:alt")?.length > 20, `${page.path} og:image:alt`);
    assert.equal(tag("og:video"), urls["og:video"], page.path);
    assert.equal(tag("og:video:secure_url"), urls["og:video"], page.path);
    assert.equal(tag("og:video:type"), "video/mp4", page.path);
    assert.equal(tag("og:video:width"), "1200", page.path);
    assert.equal(tag("og:video:height"), "630", page.path);
    assert.equal(tag("twitter:card"), "summary_large_image", page.path);
    assert.equal(tag("twitter:image"), urls["og:image"], page.path);
    assert.equal(tag("twitter:image:alt"), tag("og:image:alt"), page.path);
  }
});

test("share media returns 200 with its type, an immutable cache and byte ranges", async () => {
  const html = await (await get("/")).text();
  for (const m of MEDIA) {
    const path = new URL(meta(html, m.key)).pathname;
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("content-type"), m.type, path);
    assert.equal(res.headers.get("cache-control"), IMMUTABLE, path);
    assert.equal(res.headers.get("accept-ranges"), "bytes", path);
    const body = Buffer.from(await res.arrayBuffer());
    assert.ok(body.equals(await pubBytes(m.file)), `${path} serves public/${m.file}`);
    assert.equal(res.headers.get("content-length"), String(body.length));
  }
});

test("the share image is a 1200x630 PNG and the video is a faststart MP4", async () => {
  const png = await pubBytes("media/share.png");
  assert.ok(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.ok(png.length < 150 * 1024, `share.png is ${png.length} bytes`);
  const mp4 = await pubBytes("media/share.mp4");
  assert.equal(mp4.toString("latin1", 4, 8), "ftyp");
  assert.ok(mp4.indexOf("moov") < mp4.indexOf("mdat"), "moov comes before mdat, so playback starts before the download ends");
  assert.ok(mp4.length < 1024 * 1024, `share.mp4 is ${mp4.length} bytes`);
});

test("a Range request gets a 206 with the right bytes", async () => {
  const path = new URL(meta(await (await get("/")).text(), "og:video")).pathname;
  const mp4 = await pubBytes("media/share.mp4");
  const size = mp4.length;
  const cases = [
    ["bytes=0-99", 0, 99],
    ["bytes=1000-", 1000, size - 1],
    ["bytes=-500", size - 500, size - 1],
    [`bytes=${size - 10}-${size + 1000}`, size - 10, size - 1],
  ];
  for (const [range, first, last] of cases) {
    const res = await get(path, { headers: { Range: range } });
    assert.equal(res.status, 206, range);
    assert.equal(res.headers.get("content-range"), `bytes ${first}-${last}/${size}`, range);
    assert.equal(res.headers.get("content-length"), String(last - first + 1), range);
    assert.equal(res.headers.get("content-type"), "video/mp4", range);
    assert.equal(res.headers.get("cache-control"), IMMUTABLE, range);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(mp4.subarray(first, last + 1)), range);
  }
  // HEAD gets the same headers and no body.
  const head = await get(path, { method: "HEAD", headers: { Range: "bytes=0-99" } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get("content-length"), "100");
  assert.equal(await head.text(), "");
  // Several ranges, a backwards range, or an If-Range that doesn't match: the whole file.
  for (const headers of [{ Range: "bytes=0-1,5-6" }, { Range: "bytes=50-10" }, { Range: "bytes=0-99", "If-Range": '"old"' }]) {
    const res = await get(path, { headers });
    assert.equal(res.status, 200, JSON.stringify(headers));
    assert.equal(res.headers.get("content-length"), String(size));
    await res.arrayBuffer();
  }
  const etag = head.headers.get("etag");
  assert.equal((await get(path, { headers: { Range: "bytes=0-99", "If-Range": etag } })).status, 206);
});

test("an unsatisfiable Range gets a 416", async () => {
  const path = new URL(meta(await (await get("/")).text(), "og:video")).pathname;
  const size = (await pubBytes("media/share.mp4")).length;
  for (const range of [`bytes=${size}-`, `bytes=${size + 100}-${size + 200}`, "bytes=-0"]) {
    const res = await get(path, { headers: { Range: range } });
    assert.equal(res.status, 416, range);
    assert.equal(res.headers.get("content-range"), `bytes */${size}`, range);
    assert.equal(await res.text(), "");
  }
});

test("index file paths redirect to their clean route", async () => {
  const cases = [["/index", "/"], ["/index.html?x=1", "/?x=1"], ["/convert/index.html", "/convert"], ["/about/index", "/about"]];
  for (const [path, location] of cases) {
    const res = await get(path);
    assert.equal(res.status, 301, path);
    assert.equal(res.headers.get("location"), location, path);
  }
});

test("unknown paths serve the 404 page", async () => {
  for (const path of ["/nope", "/convert/nope", "/deal/x", "/404", "/404.html", "/index.html/x", "/%E0%A4%A"]) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.match(await res.text(), /<title>Page not found \| Toilet Paper Math<\/title>/);
  }
});

test("www redirects to the apex with path and query", async () => {
  for (const path of ["/convert?roll=1", "/styles.css?v=2"]) {
    const res = await get(path, {}, "www.toiletpaper.app");
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), `https://toiletpaper.app${path}`);
  }
});

test("HEAD has headers and an empty body", async () => {
  const res = await get("/convert", { method: "HEAD" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.ok(res.headers.get("etag"));
  assert.equal(await res.text(), "");
});

test("a matching If-None-Match gets a 304", async () => {
  const etag = (await get("/styles.css")).headers.get("etag");
  assert.match(etag, /^"[^"]+"$/);
  const res = await get("/styles.css", { headers: { "If-None-Match": `"other", ${etag}` } });
  assert.equal(res.status, 304);
  assert.equal(res.headers.get("etag"), etag);
  assert.equal(await res.text(), "");
  assert.equal((await get("/styles.css", { headers: { "If-None-Match": '"stale"' } })).status, 200);
  // Revalidating HTML keeps no-cache on the 304.
  const page = await get("/convert", { headers: { "If-None-Match": (await get("/convert")).headers.get("etag") } });
  assert.equal(page.status, 304);
  assert.equal(page.headers.get("cache-control"), "no-cache");
});

test("HTML has a weak ETag and If-None-Match accepts weak and strong forms", async () => {
  for (const path of ["/", "/convert", "/about"]) {
    const etag = (await get(path)).headers.get("etag");
    assert.match(etag, /^W\/"[^"]+"$/, path);
    const strong = etag.slice(2);
    for (const inm of [etag, strong, `"other", ${strong}`, `W/"other", ${etag}`]) {
      const res = await get(path, { headers: { "If-None-Match": inm } });
      assert.equal(res.status, 304, `${path} If-None-Match: ${inm}`);
      assert.equal(res.headers.get("etag"), etag);
    }
    assert.equal((await get(path, { headers: { "If-None-Match": 'W/"other"' } })).status, 200, path);
  }
  // Assets keep a strong ETag, and a weak form of it still revalidates.
  const css = (await get("/styles.css")).headers.get("etag");
  assert.match(css, /^"[^"]+"$/);
  assert.equal((await get("/styles.css", { headers: { "If-None-Match": `W/${css}` } })).status, 304);
  // A weak ETag can't satisfy If-Range, so the whole page comes back.
  const etag = (await get("/")).headers.get("etag");
  assert.equal((await get("/", { headers: { Range: "bytes=0-9", "If-Range": etag } })).status, 200);
});

test("other methods get a 405", async () => {
  const res = await get("/", { method: "POST", body: "x" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, HEAD");
});
