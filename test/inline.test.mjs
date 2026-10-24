import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import worker from "../dist-inline/index.js";

const get = (path, init = {}, host = "toiletpaper.app") => worker.fetch(new Request(`https://${host}${path}`, init));
const pub = (file) => readFile(new URL(`../public/${file}`, import.meta.url), "utf8");
const pick = (html, re) => (re.exec(html) || [])[1];

const PAGES = [
  { path: "/", file: "index.html", title: "Which toilet paper pack is the better deal? | Toilet Paper Math" },
  { path: "/convert", file: "convert/index.html", title: "Roll converter: what Mega, Mega XL and Super Mega really mean | Toilet Paper Math" },
  { path: "/about", file: "about/index.html", title: "How it works and sources | Toilet Paper Math" },
];

for (const page of PAGES) {
  test(`${page.path} returns 200 with its own title and meta tags`, async () => {
    const res = await get(page.path);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(res.headers.get("cache-control"), "public, max-age=300");
    const html = await res.text();
    assert.equal(html, await pub(page.file));
    assert.equal(pick(html, /<title>([^<]*)<\/title>/), page.title);
    const url = `https://toiletpaper.app${page.path}`;
    assert.equal(pick(html, /<link rel="canonical" href="([^"]*)">/), url);
    assert.equal(pick(html, /<meta property="og:url" content="([^"]*)">/), url);
    assert.ok(pick(html, /<meta name="description" content="([^"]+)">/));
    assert.ok(pick(html, /<meta property="og:title" content="([^"]+)">/));
    assert.ok(pick(html, /<meta property="og:description" content="([^"]+)">/));
    // Every page links to every tool, and marks itself as current.
    for (const other of PAGES) assert.ok(html.includes(`<a href="${other.path}"`), `${page.path} links to ${other.path}`);
    assert.ok(html.includes(`<a href="${page.path}" aria-current="page">`));
  });
}

test("trailing-slash routes also return 200", async () => {
  for (const path of ["/convert/", "/about/"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /<title>/);
  }
});

test("sheet count is the default comparison on both tools", async () => {
  const deal = await (await get("/")).text();
  assert.match(deal, /<input type="radio" name="judge" value="sheets" checked>/);
  assert.doesNotMatch(deal, /name="judge" value="(area|ply)" checked/);
  const convert = await (await get("/convert")).text();
  assert.match(convert, /<input type="radio" name="conv-mode" value="sheets" checked>/);
  assert.doesNotMatch(convert, /name="conv-mode" value="(area|ply)" checked/);
  // app.js reads the checked radio and falls back to sheets.
  const app = await (await get("/app.js")).text();
  assert.match(app, /checkedValue\("judge", "sheets"\)/);
  assert.match(app, /checkedValue\("conv-mode", "sheets"\)/);
});

test("/styles.css, /app.js and /data.js serve with their types", async () => {
  const css = await get("/styles.css");
  assert.equal(css.status, 200);
  assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(css.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(await css.text(), await pub("styles.css"));
  for (const path of ["/app.js", "/data.js"]) {
    const js = await get(path);
    assert.equal(js.status, 200);
    assert.equal(js.headers.get("content-type"), "text/javascript; charset=utf-8");
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
  for (const path of ["/nope", "/convert/nope", "/deal/x", "/404.html", "/%E0%A4%A"]) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
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
});

test("other methods get a 405", async () => {
  const res = await get("/", { method: "POST", body: "x" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, HEAD");
});
