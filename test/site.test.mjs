// SEO, structured data, crawler files, the JSON API and links with state. Runs against the
// built Worker, dist-inline/index.js (npm test builds it first).

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import worker from "../dist-inline/index.js";
import { CRAWLERS } from "../src/site/files.mjs";
import { INDEXNOW_KEY } from "../src/site/config.mjs";
import { loadCore } from "../src/site/load.mjs";

const ORIGIN = "https://toiletpaper.app";
const get = (path, init = {}) => worker.fetch(new Request(ORIGIN + path, init));
const html = async (path) => (await get(path)).text();
const json = async (path, init) => (await get(path, init)).json();
const pick = (text, re) => (re.exec(text) || [])[1];
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const { D, Core } = loadCore(fileURLToPath(new URL("..", import.meta.url)));

const INDEXED = [
  "/", "/convert", "/about", "/data", "/softness",
  "/charmin-mega-vs-quilted-northern-mega", "/how-many-sheets-in-a-mega-roll", "/cheapest-toilet-paper-per-sheet",
];
const GUIDES = INDEXED.slice(5);
const absolute = (path) => ORIGIN + (path === "/" ? "/" : path);
const ldOf = (page) => [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const graphOf = (page) => ldOf(page).flatMap((d) => d["@graph"] ?? [d]);

// ---------- SEO basics ----------
test("every page has its own title and description, one h1, lang and theme-color", async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const path of [...INDEXED, "/nope"]) {
    const page = await html(path);
    const title = pick(page, /<title>([^<]+)<\/title>/);
    const description = pick(page, /<meta name="description" content="([^"]+)">/);
    assert.ok(title && !titles.has(title), `${path} title is unique`);
    assert.ok(description && !descriptions.has(description), `${path} description is unique`);
    assert.ok(description.length >= 70 && description.length <= 170, `${path} description is ${description.length} chars`);
    titles.add(title);
    descriptions.add(description);
    assert.match(page, /^<!doctype html>\n<html lang="en">/, path);
    assert.equal((page.match(/<h1[\s>]/g) || []).length, 1, `${path} has one h1`);
    assert.match(page, /<meta name="theme-color" content="#[0-9A-F]{6}">/, path);
    assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/, path);
    // Headings don't skip levels.
    const levels = [...page.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `${path}: h${levels[i - 1]} then h${levels[i]}`);
  }
});

test("indexed pages have an absolute canonical without a trailing slash; the 404 is noindex", async () => {
  for (const path of INDEXED) {
    const page = await html(path);
    assert.equal(pick(page, /<link rel="canonical" href="([^"]+)">/), absolute(path), path);
    assert.doesNotMatch(page, /name="robots"/, path);
  }
  const lost = await get("/nope");
  assert.equal(lost.status, 404);
  const page = await lost.text();
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(page, /rel="canonical"/);
  for (const path of ["/", "/convert", ...GUIDES]) assert.ok(page.includes(`href="${path}"`), `404 links to ${path}`);
});

test("images have alt text or are hidden, and form fields have labels", async () => {
  for (const path of INDEXED) {
    const page = await html(path);
    for (const img of page.match(/<img [^>]*>/g) || []) assert.match(img, /\salt="/, `${path}: ${img}`);
    for (const svg of page.match(/<svg [^>]*>/g) || []) assert.match(svg, /aria-hidden="true"|role="img"/, `${path}: ${svg}`);
    for (const m of page.matchAll(/<(?:input|select)\b[^>]*>/g)) {
      const field = m[0];
      const before = page.slice(0, m.index);
      const wrapped = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
      const id = pick(field, /\sid="([^"]+)"/);
      assert.ok(wrapped || /aria-label=/.test(field) || (id && page.includes(`for="${id}"`)), `${path}: ${field} has a label`);
    }
  }
});

test("favicons, the touch icon and the manifest are linked and served", async () => {
  const page = await html("/");
  const ico = await get("/favicon.ico");
  assert.equal(ico.status, 200);
  assert.equal(ico.headers.get("content-type"), "image/x-icon");
  assert.equal(ico.headers.get("cache-control"), "public, max-age=86400");
  const svg = pick(page, /<link rel="icon" href="([^"]+)" type="image\/svg\+xml">/);
  assert.match(svg, /^\/icon\.[0-9a-f]{10}\.svg$/);
  assert.equal((await get(svg)).headers.get("content-type"), "image/svg+xml; charset=utf-8");
  const touch = pick(page, /<link rel="apple-touch-icon" href="([^"]+)">/);
  const png = Buffer.from(await (await get(touch)).arrayBuffer());
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [180, 180]);
  assert.equal((await get("/apple-touch-icon.png")).status, 200, "the plain path works for browsers that guess it");
  assert.match(page, /<link rel="manifest" href="\/site.webmanifest">/);
  const res = await get("/site.webmanifest");
  assert.equal(res.headers.get("content-type"), "application/manifest+json; charset=utf-8");
  const manifest = await res.json();
  assert.equal(manifest.start_url, "/");
  for (const icon of manifest.icons) {
    const r = await get(icon.src);
    assert.equal(r.status, 200, icon.src);
    if (icon.type === "image/png") {
      const b = Buffer.from(await r.arrayBuffer());
      assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, icon.sizes, icon.src);
    }
  }
});

test("pages are server-rendered, including a default comparison result", async () => {
  const page = await html("/");
  const result = strip(pick(page, /<aside[^>]*id="deal-result"[^>]*>([\s\S]*?)<\/aside>/) || "");
  assert.match(result, /Pack [AB]/);
  assert.match(result, /cheaper per sheet/);
  assert.match(await html("/convert"), /One Charmin Ultra Soft Mega XL equals/);
});

// ---------- structured data ----------
test("JSON-LD is valid JSON with WebSite everywhere, WebApplication on tools and breadcrumbs on subpages", async () => {
  for (const path of INDEXED) {
    const page = await html(path);
    const graph = graphOf(page);
    const types = graph.map((n) => n["@type"]);
    assert.ok(types.includes("WebSite"), `${path} has WebSite`);
    const site = graph.find((n) => n["@type"] === "WebSite");
    assert.equal(site.url, ORIGIN + "/");
    if (path === "/" || path === "/convert") {
      const app = graph.find((n) => n["@type"] === "WebApplication");
      assert.ok(app, `${path} has WebApplication`);
      assert.equal(app.url, absolute(path));
      assert.equal(app.offers?.price, "0");
    }
    if (path !== "/") {
      const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList");
      assert.ok(crumbs, `${path} has BreadcrumbList`);
      assert.equal(crumbs.itemListElement[0].item, ORIGIN + "/");
      assert.equal(crumbs.itemListElement.at(-1).item, absolute(path));
    }
  }
});

test("the FAQPage JSON-LD matches the FAQ visible on /about", async () => {
  const page = await html("/about");
  const faq = graphOf(page).find((n) => n["@type"] === "FAQPage");
  assert.ok(faq.mainEntity.length >= 5);
  const section = pick(page, /<section class="about-section faq"[^>]*>([\s\S]*?)<\/section>/);
  const items = [...section.matchAll(/<details class="faq-item" id="[a-z-]+"><summary>([\s\S]*?)<\/summary><div class="faq-answer">([\s\S]*?)<\/div><\/details>/g)];
  assert.equal(items.length, (section.match(/<details/g) || []).length, "every FAQ item has the expected markup");
  const visible = items.map((m) => ({ q: strip(m[1]), a: strip(m[2]) }));
  assert.deepEqual(faq.mainEntity.map((q) => ({ q: q.name, a: q.acceptedAnswer.text })), visible);
  for (const path of INDEXED.filter((p) => p !== "/about")) assert.ok(!graphOf(await html(path)).some((n) => n["@type"] === "FAQPage"), path);
});

// ---------- crawler files ----------
test("robots.txt allows every listed crawler and points at the sitemap", async () => {
  const res = await get("/robots.txt");
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  const robots = await res.text();
  for (const bot of [...CRAWLERS, "*"]) assert.ok(robots.includes(`User-agent: ${bot}\nAllow: /\n`), bot);
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Googlebot", "Bingbot", "Applebot", "DuckDuckBot"]) {
    assert.ok(CRAWLERS.includes(bot), bot);
  }
  assert.doesNotMatch(robots, /Disallow/);
  assert.match(robots, /\nSitemap: https:\/\/toiletpaper\.app\/sitemap\.xml\n$/);
});

test("sitemap.xml lists every indexed page with lastmod, and nothing else", async () => {
  const res = await get("/sitemap.xml");
  assert.equal(res.headers.get("content-type"), "application/xml; charset=utf-8");
  const xml = await res.text();
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  const urls = [...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod><\/url>/g)];
  assert.deepEqual(urls.map((m) => m[1]), INDEXED.map(absolute));
  for (const path of INDEXED) assert.equal((await get(path)).status, 200, path);
});

test("every page's footer is one line: the disclaimer and the repo link", async () => {
  for (const path of [...INDEXED, "/nope"]) {
    const footer = pick(await html(path), /<footer[^>]*>([\s\S]*?)<\/footer>/);
    assert.equal((footer.match(/<p[ >]/g) || []).length, 1, `${path}: one paragraph`);
    assert.doesNotMatch(footer, /<(ul|ol|li)[ >]/, `${path}: no lists`);
    assert.deepEqual([...footer.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]), ['<a href="https://github.com/ahatzz11/toiletpaper">'], path);
    assert.equal(strip(footer), "Not affiliated with any brand · Open source on GitHub", path);
  }
});

test("every guide is linked from /about and the 404 page", async () => {
  for (const path of ["/about", "/nope"]) {
    const page = await html(path);
    for (const guide of GUIDES) assert.ok(page.includes(`href="${guide}"`), `${path} links ${guide}`);
  }
});

test("/about is the plain-language page and /data holds the technical material", async () => {
  const about = pick(await html("/about"), /<main[^>]*>([\s\S]*?)<\/main>/);
  for (const bit of ["/api/", "openapi", "llms", "?mode=", "<table", "<pre", "<code"]) assert.ok(!about.includes(bit), `/about has no ${bit}`);
  assert.ok(about.includes('href="/data#sources"'), "/about points to the sources on /data");
  assert.match(about, /<details class="faq-item" id="sources">/, "old /about#sources links land on the sources answer");
  assert.match(about, /<details class="faq-item" id="data">/, "old /about#data links land on the data answer");
  const data = pick(await html("/data"), /<main[^>]*>([\s\S]*?)<\/main>/);
  for (const bit of ['href="/api/products"', 'href="/api/compare?', 'href="/openapi.json"', 'href="/llms.txt"', 'href="/llms-full.txt"', "?mode=sheets&amp;a=", "custom:&lt;sheets&gt;", "/convert?roll=", 'id="sources"', "<table"]) {
    assert.ok(data.includes(bit), `/data has ${bit}`);
  }
  const ld = graphOf(await html("/data"));
  assert.deepEqual(ld.find((n) => n["@type"] === "BreadcrumbList").itemListElement.map((i) => i.name), ["Home", "Data & API"]);
});

test("the API example on /data is the API's real output", async () => {
  const data = await html("/data");
  const link = pick(data, /<a href="(\/api\/compare\?[^"]+)">/).replace(/&amp;/g, "&");
  const shown = pick(data, /<pre class="code-block"><code>([\s\S]*?)<\/code><\/pre>/).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  assert.deepEqual(JSON.parse(shown), await json(link));
});

test("llms.txt and llms-full.txt are Markdown with absolute links", async () => {
  const res = await get("/llms.txt");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  const llms = await res.text();
  assert.match(llms, /^# Toilet Paper Math\n\n> .+\n/);
  for (const path of INDEXED) assert.ok(llms.includes(`](${absolute(path)})`), `llms.txt links ${path}`);
  for (const url of ["/api/products", "/openapi.json", "/llms-full.txt"]) assert.ok(llms.includes(`(${ORIGIN}${url})`), url);
  assert.match(llms, /https:\/\/toiletpaper\.app\/\?mode=sheets&a=[a-z0-9-]+,\d+,[\d.]+&b=/, "has a deep-link example");
  assert.doesNotMatch(llms, /\]\(\//, "no relative links");
  const full = await (await get("/llms-full.txt")).text();
  for (const p of D.products) assert.ok(full.includes(`| ${p.id} | ${p.sheets}`), `llms-full.txt has ${p.id}`);
  for (const q of graphOf(await html("/about")).find((n) => n["@type"] === "FAQPage").mainEntity) {
    assert.ok(full.includes(`### ${q.name}\n\n${q.acceptedAnswer.text}`), q.name);
  }
});

test("openapi.json is OpenAPI 3.1 and describes both endpoints", async () => {
  const res = await get("/openapi.json");
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  const spec = JSON.parse(await res.text());
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, ORIGIN);
  assert.deepEqual(Object.keys(spec.paths), ["/api/products", "/api/compare"]);
  const params = spec.paths["/api/compare"].get.parameters.map((p) => p.name);
  assert.deepEqual(params, ["mode", "p", "a", "b", "c", "d", "e", "f", "g", "h"]);
  assert.deepEqual(spec.paths["/api/compare"].get.parameters[1].schema.enum, ["cheap", "balanced", "soft"]);
  assert.ok(spec.components.schemas.Product.properties.softness);
  // Every $ref resolves.
  for (const ref of JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)) assert.ok(spec.components.schemas[ref[1]], ref[1]);
  // The documented example works.
  const a = spec.paths["/api/compare"].get.parameters.find((p) => p.name === "a").example;
  const b = spec.paths["/api/compare"].get.parameters.find((p) => p.name === "b").example;
  assert.equal((await get(`/api/compare?a=${a}&b=${b}`)).status, 200);
  // Linked from llms.txt and the about page.
  assert.ok((await html("/data")).includes('href="/openapi.json"'));
  assert.equal(spec.externalDocs.url, `${ORIGIN}/data`);
});

test("the IndexNow key file serves the key as plain text", async () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
  const res = await get(`/${INDEXNOW_KEY}.txt`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await res.text(), INDEXNOW_KEY);
});

// ---------- API ----------
test("GET /api/products lists every brand and roll", async () => {
  const res = await get("/api/products");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const etag = res.headers.get("etag");
  assert.match(etag, /^"[^"]+"$/);
  const body = await res.json();
  assert.equal(body.brands.length, Object.keys(D.brands).length);
  assert.equal(body.products.length, D.products.length);
  for (const p of body.products) {
    for (const key of ["id", "brand", "name", "size", "sheetsPerRoll", "sheetWidthIn", "sheetLengthIn", "sqFtPerRoll", "ply", "regularRolls", "source", "sourceUrl"]) {
      assert.ok(key in p, `${p.id}.${key}`);
    }
    assert.ok(Math.abs(p.sqFtPerRoll - (p.sheetsPerRoll * p.sheetWidthIn * p.sheetLengthIn) / 144) < 0.006, p.id);
    if (p.sourceUrl) assert.match(p.sourceUrl, /^https:\/\//, p.id);
  }
  const notModified = await get("/api/products", { headers: { "If-None-Match": etag } });
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("access-control-allow-origin"), "*");
});

test("the HTML tables, the API and llms-full.txt agree", async () => {
  const api = (await json("/api/products")).products;
  const data = await html("/data");
  for (const p of api) {
    const row = pick(data, new RegExp(`<a href="/convert\\?roll=${p.id}">[^<]*</a></th>([\\s\\S]*?)</tr>`));
    assert.ok(row, `/data has a row for ${p.id}`);
    const cells = [...row.matchAll(/<td class="num">([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    assert.equal(parseInt(cells[0], 10), p.sheetsPerRoll, p.id);
    assert.ok(cells[1].startsWith(`${p.sheetWidthIn} × ${p.sheetLengthIn} in`), `${p.id}: ${cells[1]}`);
    assert.equal(Number(cells[2]), p.ply, p.id);
  }
});

// ---------- a brand without "= N regular" claims ----------
test("Kirkland Signature is a fourth brand with its own roll as the unit", async () => {
  const kirkland = D.brands.kirkland;
  assert.equal(kirkland.regularId, null);
  const rolls = D.products.filter((p) => p.brand === "kirkland");
  assert.deepEqual(rolls.map((p) => [p.id, p.sheets, p.width, p.length, p.ply, p.defaultRolls, p.claim]), [
    ["kirkland-signature-bath-tissue", 380, 4.5, 4, 2, 30, null],
    ["kirkland-signature-ultra-soft-bath-tissue", 231, 4.5, 4, 2, 36, null],
  ]);
  for (const p of rolls) {
    // Costco's printed pack totals match our math exactly.
    assert.equal(Core.round(Core.sqFtOf(p) * p.printedTotal.rolls, 1), p.printedTotal.sqft, p.id);
    assert.match(p.sources[0].url, /^https:\/\/www\.costco\.com\//, `${p.id}: Costco's own page comes first`);
  }

  const api = await json("/api/products");
  assert.deepEqual(api.brands.find((b) => b.id === "kirkland-signature"), { id: "kirkland-signature", name: "Kirkland Signature", maker: "Costco", regularRollId: null, regularRollSheets: null });
  const row = api.products.find((p) => p.id === "kirkland-signature-bath-tissue");
  assert.equal(row.regularRolls, null);
  assert.equal(row.regularRollSheets, null);
  assert.equal(row.sqFtPerRoll, 47.5);

  const cmp = await json("/api/compare?a=kirkland-signature-bath-tissue,30,24.99&b=charmin-ultra-soft-mega,6,9.99");
  assert.equal(cmp.packs[0].totalSheets, 11400);

  const deal = await html("/");
  assert.match(deal, /<optgroup label="Kirkland Signature"><option value="kirkland-signature-bath-tissue"/);
  const conv = await html("/convert?roll=kirkland-signature-bath-tissue");
  const check = strip(pick(conv, /<p class="claim-check" id="conv-claim-check">([\s\S]*?)<\/p>/));
  assert.match(check, /^Kirkland Signature doesn't print an "= N regular" claim, so its own roll is the unit\. By sheet count one roll is 7\.31 Charmin, 6\.03 Quilted Northern or 4\.75 Angel Soft regular rolls\.$/);
  // Only brands with a regular roll get an "equals" tile.
  assert.equal((conv.match(/class="eq-tile /g) || []).length, Object.values(D.brands).filter((b) => b.regularId).length);

  for (const path of ["/", "/convert", "/about", "/data", "/cheapest-toilet-paper-per-sheet", "/llms.txt", "/llms-full.txt"]) {
    assert.ok((await html(path)).includes("Kirkland Signature"), `${path} mentions Kirkland Signature`);
  }
  // Kirkland sells no Mega rolls, so the Mega guide doesn't claim it does.
  const mega = await html("/how-many-sheets-in-a-mega-roll");
  assert.ok(!pick(mega, /<meta name="description" content="([^"]+)">/).includes("Kirkland"));
});

test("GET /api/compare does the math", async () => {
  const res = await get("/api/compare?mode=sheets&a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "public, max-age=300");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const body = await res.json();
  const [a, b] = body.packs;
  const ch = Core.byId["charmin-ultra-soft-mega"];
  const qn = Core.byId["quilted-northern-ultra-plush-mega"];
  assert.equal(a.totalSheets, 6 * ch.sheets);
  assert.equal(a.pricePer100Sheets, Core.round((9.99 / (6 * ch.sheets)) * 100, 4));
  assert.equal(b.pricePer100Sheets, Core.round((8.99 / (6 * qn.sheets)) * 100, 4));
  assert.equal(a.pricePerSqFt, Core.round(9.99 / ((6 * ch.sheets * ch.width * ch.length) / 144), 4));
  assert.equal(body.winner, "b");
  assert.equal(b.best, true);
  assert.equal(b.percentMoreThanBest, 0);
  const ratio = (9.99 / (6 * ch.sheets)) / (8.99 / (6 * qn.sheets));
  assert.equal(a.percentMoreThanBest, Core.round((ratio - 1) * 100, 1));
  assert.equal(body.percentCheaperThanPriciest, Core.round((1 - 1 / ratio) * 100, 1));
  assert.equal(body.link, `${ORIGIN}/?mode=sheets&a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99`);
  // The link opens the same comparison in the calculator.
  assert.equal(strip(pick(await html(new URL(body.link).pathname + new URL(body.link).search), /<p class="result-sentence[^"]*">([\s\S]*?)<\/p>/) || body.summary), body.summary);

  // Each mode picks its own winner; ply is an alias for areaply.
  const area = await json("/api/compare?mode=area&a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99");
  assert.equal(area.mode, "area");
  assert.equal((await json("/api/compare?mode=ply&a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99")).mode, "areaply");
  // Equal costs are a tie.
  const tie = await json("/api/compare?a=charmin-ultra-soft-mega,6,9.99&b=charmin-ultra-soft-mega,12,19.98");
  assert.equal(tie.winner, null);
  assert.deepEqual(tie.tie, ["a", "b"]);
  // Custom rolls and 8 packs.
  const eight = "abcdefgh".split("").map((l, i) => `${l}=custom:${200 + i * 10}:4x4:2,6,9.99`).join("&");
  const many = await json(`/api/compare?${eight}`);
  assert.equal(many.packs.length, 8);
  assert.equal(many.winner, "h");
});

test("GET /api/compare returns JSON 400s for bad input", async () => {
  const bad = [
    "", "?a=charmin-ultra-soft-mega,6,9.99", "?a=nope,6,9.99&b=charmin-ultra-soft-mega,6,9.99",
    "?a=charmin-ultra-soft-mega,0,9.99&b=charmin-ultra-soft-mega,6,9.99", "?a=charmin-ultra-soft-mega,6,-1&b=charmin-ultra-soft-mega,6,9.99",
    "?a=charmin-ultra-soft-mega,6&b=charmin-ultra-soft-mega,6,9.99", "?mode=cheap&a=charmin-ultra-soft-mega,6,9.99&b=charmin-ultra-soft-mega,6,9.99",
    "?a=charmin-regular,6,9.99&b=charmin-ultra-soft-mega,6,9.99", "?a=custom:99999:4x4:2,6,9.99&b=charmin-ultra-soft-mega,6,9.99",
  ];
  for (const q of bad) {
    const res = await get(`/api/compare${q}`);
    assert.equal(res.status, 400, q);
    assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8", q);
    assert.equal(res.headers.get("access-control-allow-origin"), "*", q);
    const body = await res.json();
    assert.equal(typeof body.error, "string", q);
  }
});

test("the API answers CORS preflight and refuses writes with 405", async () => {
  for (const path of ["/api/products", "/api/compare"]) {
    const res = await get(path, { method: "OPTIONS", headers: { Origin: "https://example.com", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-test" } });
    assert.equal(res.status, 204, path);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(res.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
    assert.equal(res.headers.get("access-control-allow-headers"), "x-test");
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const r = await get(path, { method, ...(method === "DELETE" ? {} : { body: "{}" }) });
      assert.equal(r.status, 405, `${method} ${path}`);
      assert.equal(r.headers.get("allow"), "GET, HEAD, OPTIONS");
      assert.equal(r.headers.get("content-type"), "application/json; charset=utf-8");
      assert.ok((await r.json()).error);
    }
  }
  const head = await get("/api/compare?a=charmin-ultra-soft-mega,6,9.99&b=charmin-ultra-soft-mega-xl,6,12.99", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const missing = await get("/api/nope");
  assert.equal(missing.status, 404);
  assert.ok((await missing.json()).error);
});

// ---------- links with state ----------
test("deal links round-trip through the parser", () => {
  const state = {
    mode: "area", example: false,
    packs: [
      Core.newPack("charmin-ultra-strong-mega-xl", 8, "15.49"),
      Core.newPack("quilted-northern-ultra-plush-mega", 12, ""),
      { productId: "custom", rolls: "24", price: "19.99", custom: { sheets: "300", width: "4", length: "3.9", ply: "2" } },
    ],
  };
  const link = Core.dealLink(state);
  assert.equal(link, `${ORIGIN}/?mode=area&a=charmin-ultra-strong-mega-xl,8,15.49&b=quilted-northern-ultra-plush-mega,12,&c=custom:300:4x3.9:2,24,19.99`);
  const back = Core.parseDeal(new URL(link).searchParams, false);
  assert.equal(back.linked, true);
  assert.deepEqual(back.problems, []);
  assert.equal(back.state.mode, "area");
  assert.deepEqual(back.state.packs.map((p) => [p.productId, p.rolls, p.price]), state.packs.map((p) => [p.productId, p.rolls, p.price]));
  assert.deepEqual(back.state.packs[2].custom, state.packs[2].custom);
  assert.equal(Core.dealLink(back.state), link);
  // The untouched example has no query at all.
  assert.equal(Core.dealLink(Core.defaultDeal()), ORIGIN + "/");
  // Converter state.
  assert.equal(Core.converterQuery({ roll: "quilted-northern-ultra-plush-mega", mode: "areaply" }), "roll=quilted-northern-ultra-plush-mega&mode=areaply");
  const conv = Core.parseConverter(new URLSearchParams("roll=quilted-northern-ultra-plush-mega&mode=areaply")).state;
  assert.deepEqual(conv, { roll: "quilted-northern-ultra-plush-mega", mode: "areaply" });
});

test("bad link values are ignored without breaking the page", async () => {
  const parsed = Core.parseDeal(new URLSearchParams("mode=nope&a=zzz,1,1&b=charmin-ultra-soft-mega,0,5&c=charmin-ultra-soft-mega,4,abc&d=charmin-ultra-soft-mega-xl,6,"), false);
  assert.equal(parsed.state.mode, "sheets");
  assert.deepEqual(parsed.state.packs.map((p) => p.productId), ["charmin-ultra-soft-mega-xl"]);
  assert.equal(parsed.problems.length, 4);
  const none = Core.parseDeal(new URLSearchParams("a=%3Cscript%3E,1,1"), false);
  assert.equal(none.linked, false, "nothing usable falls back to the example");
  for (const q of ["?a=<script>alert(1)</script>,1,1", "?mode=%00&a=,,,", "?roll=../../etc", "?a=custom:1:999x1:9,1,1"]) {
    for (const path of ["/", "/convert"]) {
      const res = await get(path + q);
      assert.equal(res.status, 200, path + q);
      const page = await res.text();
      assert.doesNotMatch(page, /<script>alert/, path + q);
      assert.equal(pick(page, /<link rel="canonical" href="([^"]+)">/), absolute(path), path + q);
    }
  }
});

test("linked pages render the linked result on the server, with a clean canonical", async () => {
  const query = "?mode=area&a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99";
  const res = await get("/" + query);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-cache");
  const page = await res.text();
  assert.equal(pick(page, /<link rel="canonical" href="([^"]+)">/), ORIGIN + "/");
  assert.equal(pick(page, /<meta property="og:url" content="([^"]+)">/), ORIGIN + "/");
  assert.match(page, /<input type="radio" name="judge" value="area" autocomplete="off" checked>/);
  assert.match(page, /value="8.99"/);
  const summary = (await json("/api/compare" + query)).summary;
  assert.equal(pick(page, /<meta property="og:description" content="([^"]+)">/), Core.esc(summary));
  assert.equal(page.match(/<!--tool-->/g).length, 1);

  const conv = await html("/convert?roll=quilted-northern-ultra-plush-mega&mode=area");
  assert.match(conv, /<option value="quilted-northern-ultra-plush-mega" selected>/);
  assert.match(conv, /<input type="radio" name="conv-mode" value="area" autocomplete="off" checked>/);
  assert.equal(pick(conv, /<link rel="canonical" href="([^"]+)">/), ORIGIN + "/convert");
  // Unrelated query strings serve the static page, ETag and all.
  assert.ok((await get("/?utm_source=x")).headers.get("etag"));
});

test("prices with $ patterns don't corrupt the server-rendered page", async () => {
  const cases = [
    // The live bug: "$13.49" in the summary was read as $1 followed by "3.49".
    "?mode=area&a=charmin-ultra-soft-mega-xl,6,9.99&b=quilted-northern-ultra-soft-strong-mega,12,13.49",
    "?a=charmin-ultra-soft-mega,6,1.00&b=angel-soft-mega,12,10.00",
    // Price text with $ patterns: "$$1.00" reads as 1.00. "$&", "$`$12.99" and "$'5" aren't prices, so those packs are dropped.
    "?a=charmin-ultra-soft-mega,6,%24%241.00&b=angel-soft-mega,12,%24%26&c=angel-soft-mega-xl,8,12.99&d=charmin-ultra-soft-mega-xl,6,%24%60%2412.99&e=charmin-ultra-soft-mega-xl,6,$'5",
  ];
  for (const query of cases) {
    const page = await html("/" + query);
    const state = Core.parseDeal(new URLSearchParams(query), false).state;
    const summary = Core.resultSentence(state, Core.computeDeal(state));
    assert.match(summary, /\$\d/, query);
    assert.equal((page.match(/<meta property="og:description"/g) || []).length, 1, query);
    assert.equal(pick(page, /<meta property="og:description" content="([^"]*)">/), Core.esc(summary), query);
    assert.equal((page.match(/<title>/g) || []).length, 1, query);
    assert.equal((page.match(/<!--tool-->/g) || []).length, 1, query);
    assert.equal(page.indexOf("<!doctype html>"), 0, query);
    // The result block and the JSON-LD are intact too.
    const result = strip(pick(page, /<aside[^>]*id="deal-result"[^>]*>([\s\S]*?)<\/aside>/));
    assert.ok(result.includes(strip(Core.resultHTML(state, Core.computeDeal(state)).html)), query);
    for (const d of ldOf(page)) assert.ok(d["@graph"], query);
  }
  // Every replacement pattern comes through as text.
  const tags = '<meta property="og:description" content="old"><meta name="twitter:description" content="old">';
  for (const text of ["$1", "$13.49", "$&", "$$", "$`", "$'", "$<name>", "a $1 b $& c $$ d $` e $' f"]) {
    const out = Core.setShareDescription(tags, text);
    const want = Core.esc(text);
    assert.equal(out, `<meta property="og:description" content="${want}"><meta name="twitter:description" content="${want}">`, text);
  }
});

// ---------- data ----------
test("every product has a source, and every source URL is https", () => {
  for (const p of D.products) {
    assert.ok(p.source, p.id);
    for (const s of p.sources || []) if (s.url) assert.match(s.url, /^https:\/\/[^\s]+$/, p.id);
  }
});

test("no dashes or em dashes in generated text", async () => {
  for (const path of [...INDEXED, "/nope", "/llms.txt", "/llms-full.txt", "/robots.txt", "/openapi.json"]) {
    const text = await (await get(path)).text();
    assert.doesNotMatch(text, /[\u2013\u2014]/, path);
  }
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.doesNotMatch(readme, /[\u2013\u2014]/);
});
