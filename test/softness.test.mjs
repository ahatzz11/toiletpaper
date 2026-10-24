// Softness: the scores and their sources, the /softness scale, and the calculator's
// "What matters more?" priority (Cheapest, Balanced, Softest) in pages, links and the API.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../dist-inline/index.js";
import { loadCore } from "../src/site/load.mjs";

const ORIGIN = "https://toiletpaper.app";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const get = (path) => worker.fetch(new Request(ORIGIN + path));
const html = async (path) => (await get(path)).text();
const pick = (text, re) => (re.exec(text) || [])[1];
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const graphOf = (page) => [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"]);
const { D, Core } = loadCore(ROOT);
const S = D.softness;
const lines = Object.entries(S.lines);
const rated = lines.filter(([, l]) => l.score != null);

// A separate copy of the data with scores we control, for the winner logic.
function withScores(scores) {
  const fresh = loadCore(ROOT);
  for (const [key, l] of Object.entries(fresh.D.softness.lines)) l.score = scores[key] ?? null;
  return fresh.Core;
}
function decide(core, query) {
  const { state, problems } = core.parseDeal(new URLSearchParams(query), true);
  assert.deepEqual(problems, [], query);
  const deal = core.computeDeal(state);
  return { reason: deal.pick.reason, winners: deal.pick.winners.map((r) => core.PARAMS[state.packs.indexOf(r.pack)]).join(""), sentence: core.resultSentence(state, deal) };
}

// ---------- the scores ----------
test("every rated line has a whole-number score and dated, sourced evidence", () => {
  assert.ok(rated.length > 0, "at least one line is rated");
  for (const [key, l] of rated) {
    assert.ok(Number.isInteger(l.score) && l.score >= 1 && l.score <= S.max, `${key}: ${l.score}`);
    assert.ok(l.sources.length > 0, `${key} has a source`);
    assert.ok(l.why && l.why.length > 20, `${key} explains its score`);
    for (const id of l.sources) assert.ok(S.sources[id], `${key}: source ${id} exists`);
  }
  for (const [id, s] of Object.entries(S.sources)) {
    for (const k of ["publisher", "title", "url", "date", "dateKind", "method"]) assert.ok(s[k], `${id}.${k}`);
    assert.match(s.url, /^https:\/\//, id);
    assert.match(s.date, /^\d{4}(-\d{2}){0,2}$/, `${id} date`);
    assert.ok(lines.some(([, l]) => l.sources.includes(id)), `${id} is used by a line`);
  }
  assert.ok(S.method.length >= 3, "the method is written down");
});

test("every product you can buy belongs to a softness line; regular rolls and custom rolls are never rated", () => {
  for (const p of D.products) {
    if (p.isRegular) {
      assert.equal(p.soft, undefined, p.id);
      assert.equal(Core.softnessOf(p.id), null, p.id);
    } else {
      assert.ok(S.lines[p.soft], `${p.id} has a line`);
    }
  }
  assert.equal(Core.softnessOf("custom"), null);
  for (const [key] of lines) assert.ok(D.products.some((p) => p.soft === key), `${key} has products`);
});

test("/api/products carries each product's softness, or null when not rated", async () => {
  const body = await (await get("/api/products")).json();
  assert.equal(body.softness.outOf, S.max);
  assert.deepEqual(body.softness.method, S.method);
  for (const p of body.products) {
    const line = Core.softnessOf(p.id);
    if (!line) { assert.equal(p.softness, null, p.id); continue; }
    assert.equal(p.softness.score, line.score, p.id);
    assert.equal(p.softness.line, line.name, p.id);
    assert.deepEqual(p.softness.sources.map((s) => s.url), line.sources.map((id) => S.sources[id].url), p.id);
  }
});

// ---------- the scale ----------
test("/softness runs from 0 to 11, least soft first, with every rated line once and the reference points on their scores", async () => {
  const res = await get("/softness");
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.equal(pick(page, /<link rel="canonical" href="([^"]*)">/), ORIGIN + "/softness");
  const strip_ = pick(page, /<ol class="soft-strip"[^>]*>([\s\S]*?)<\/ol><\/div>/);
  const sheets = [...strip_.matchAll(/<li class="soft-sheet([^"]*)"[^>]*>([\s\S]*?)<\/li>(?=<li class="soft-sheet|$)/g)];
  const nums = sheets.map((m) => Number(pick(m[2], /<span class="soft-num">(\d+)<\/span>/)));
  assert.deepEqual(nums, Array.from({ length: 12 }, (_, i) => i), "a 0 row before 1, and an 11 row after 10");
  // 10 closes the roll; 11 sits on its own just past the end.
  assert.deepEqual(sheets.map((m) => /\bsoft-end\b/.test(m[1])), nums.map((n) => n === S.max));
  assert.deepEqual(sheets.map((m) => /\bsoft-beyond\b/.test(m[1])), nums.map((n) => n > S.max));
  assert.equal(strip(pick(sheets[11][2], /<p class="soft-level">([\s\S]*?)<\/p>/)), "11 out of 10 Off the scale");
  // The reference points. Kirkland stays out of it: both lines are still not rated.
  assert.deepEqual(S.anchors.map((a) => [a.id, a.score]), [["sandpaper", 0], ["porta-potty", 2], ["cloud", 11]]);
  assert.equal(S.lines["kirkland-bath-tissue"].score, null);
  assert.equal(S.lines["kirkland-ultra-soft"].score, null);
  for (const a of S.anchors) {
    const at = sheets.filter((m) => m[2].includes(`class="soft-item soft-anchor soft-${a.id}"`));
    assert.equal(at.length, 1, a.id);
    assert.equal(nums[sheets.indexOf(at[0])], a.score, a.id);
    const chip = pick(at[0][2], new RegExp(`<li class="soft-item soft-anchor soft-${a.id}">([\\s\\S]*?)</li>`));
    assert.equal(strip(pick(chip, /<span class="soft-item-name">([\s\S]*?)<\/span>/)), a.name);
    assert.equal(strip(pick(chip, /<span class="soft-caption">([\s\S]*?)<\/span>/)), a.note);
    assert.doesNotMatch(chip, /<a /, `${a.id} isn't a link to a product`);
  }
  assert.deepEqual([...sheets[2][2].matchAll(/<span class="soft-item-name">([^<]*)<\/span>/g)].map((m) => m[1]), ["Average port-a-potty toilet paper"]);
  assert.ok(!/\bLeaves\b|soft-leaves|poison ivy/.test(page), "no leaves anywhere on the page");
  assert.match(page, /Scores run from 0 to 10,/);
  // Each rated line sits on its own score, once.
  for (const [key, l] of rated) {
    const at = sheets.filter((m) => m[2].includes(`href="/softness#why-${key}"`));
    assert.equal(at.length, 1, key);
    assert.equal(Number(pick(at[0][2], /<span class="soft-num">(\d+)<\/span>/)), l.score, key);
    assert.match(page, new RegExp(`<tr class="\\w+" id="why-${key}">`), `${key} has a why row`);
  }
  // Lines without a source say so instead of sitting on the scale.
  for (const [key, l] of lines.filter(([, l]) => l.score == null)) {
    assert.doesNotMatch(strip_, new RegExp(`why-${key}"`), key);
    assert.match(page, new RegExp(`id="why-${key}">[\\s\\S]*?Not rated`), key);
  }
  // Structured data: breadcrumbs and the rated lines in the same order.
  const graph = graphOf(page);
  assert.ok(graph.some((n) => n["@type"] === "BreadcrumbList"));
  const list = graph.find((n) => n["@type"] === "ItemList");
  assert.deepEqual(list.itemListElement.map((i) => i.name.replace(/: \d+ out of \d+$/, "")),
    rated.slice().sort((a, b) => a[1].score - b[1].score).map(([, l]) => l.name));
  // Works without JavaScript: nothing on the scale is built by app.js.
  assert.doesNotMatch(await (await get("/app.js")).text(), /soft-strip|soft-sheet/);
});

test("reference points live only on the scale, and nothing calls them jokes", async () => {
  const names = S.anchors.map((a) => a.name);
  // Not a softness line, so nothing can be sold as one and Balanced never sees them.
  for (const a of S.anchors) assert.ok(!(a.id in S.lines), a.id);
  assert.ok(D.products.every((p) => !S.anchors.some((a) => a.id === p.soft)));
  const products = await (await get("/api/products")).text();
  const example = pick(await html("/data"), /<a href="(\/api\/compare\?[^"]+)">/).replace(/&amp;/g, "&");
  const compare = await (await get(example + "&p=balanced")).text();
  assert.match(compare, /"winner"/);
  for (const [where, text] of [["/api/products", products], ["/api/compare", compare]]) {
    for (const n of names) assert.ok(!text.includes(n), `${where} has no ${n}`);
  }
  for (const path of ["/", "/convert", "/data"]) {
    const main = pick(await html(path), /<main[^>]*>([\s\S]*?)<\/main>/);
    assert.ok(!main.includes("soft-anchor"), path);
    for (const n of names) assert.ok(!main.includes(n), `${path} has no ${n}`);
  }
  // No "joke" anywhere a person or an agent reads.
  const sitemap = await (await get("/sitemap.xml")).text();
  const paths = [...sitemap.matchAll(/<loc>https:\/\/toiletpaper\.app([^<]*)<\/loc>/g)].map((m) => m[1] || "/");
  assert.ok(paths.includes("/softness") && paths.includes("/data"));
  for (const path of [...paths, "/llms.txt", "/llms-full.txt", "/openapi.json"]) {
    assert.doesNotMatch(await (await get(path)).text(), /\bjokes?\b/i, path);
  }
  assert.doesNotMatch(readFileSync(ROOT + "README.md", "utf8"), /\bjokes?\b/i, "README");
});

test("/data and llms-full.txt document every softness source with its date", async () => {
  const data = await html("/data");
  const full = await (await get("/llms-full.txt")).text();
  for (const s of Object.values(S.sources)) {
    assert.ok(data.includes(`href="${s.url}"`), s.url);
    assert.ok(full.includes(s.url), s.url);
    assert.ok(full.includes(s.date), s.date);
  }
  assert.match(full, /`balanced`: start from the cheapest pack/);
});

test("the /about FAQ answers which roll is softest, and FAQPage JSON-LD matches it", async () => {
  const page = await html("/about");
  assert.match(page, /<details class="faq-item" id="softest"><summary>Which toilet paper is the softest\?<\/summary>/);
  const faq = graphOf(page).find((n) => n["@type"] === "FAQPage");
  const q = faq.mainEntity.find((e) => e.name === "Which toilet paper is the softest?");
  assert.ok(q && q.acceptedAnswer.text.includes("softness scale"));
});

// ---------- the priority ----------
const QN = "quilted-northern-ultra-plush-mega"; // 255 sheets
const AS = "angel-soft-mega"; // 320 sheets

test("Cheapest ignores softness; Softest takes the softest rated pack, then the cheaper", () => {
  const core = withScores({ "angel-soft": 5, "qn-ultra-plush": 9 });
  const q = `a=${AS},12,10&b=${QN},12,10`;
  assert.equal(decide(core, q).winners, "a");
  assert.equal(decide(core, q + "&p=cheap").reason, "cheap");
  const soft = decide(core, q + "&p=soft");
  assert.deepEqual([soft.reason, soft.winners], ["soft", "b"]);
  assert.match(soft.sentence, /is the softest pick\. Softest here \(9 out of 10\)\. It costs 25% more per sheet than Pack A, which is rated 5\/10\./);
  // Two equally soft packs: the cheaper wins.
  assert.equal(decide(core, `a=${QN},12,11&b=${QN},12,10&p=soft`).winners, "b");
});

test("Balanced pays up to 10% more per unit for each point of softness, and no more", () => {
  const core = withScores({ "angel-soft": 5, "qn-ultra-plush": 7 });
  // B is 2 points softer, so it may cost up to 20% more per sheet than A.
  const perSheetA = 10 / (12 * 320);
  const priceB = (more) => (perSheetA * (1 + more) * 12 * 255).toFixed(4);
  const within = decide(core, `a=${AS},12,10&b=${QN},12,${priceB(0.199)}&p=balanced`);
  assert.deepEqual([within.reason, within.winners], ["balanced-soft", "b"]);
  assert.match(within.sentence, /It costs 20% more per sheet than Pack A but is softer \(7 vs 5 out of 10\)\. Balanced pays up to 20% more for that\./);
  const over = decide(core, `a=${AS},12,10&b=${QN},12,${priceB(0.21)}&p=balanced`);
  assert.deepEqual([over.reason, over.winners], ["balanced-cheap", "a"]);
  assert.match(over.sentence, /Pack B is softer \(7 vs 5 out of 10\) but costs 21% more per sheet, and Balanced pays at most 20% more for that\./);
  // Nothing softer than the cheapest: the cheapest wins.
  assert.match(decide(withScores({ "angel-soft": 8, "qn-ultra-plush": 7 }), `a=${AS},12,10&b=${QN},12,10&p=balanced`).sentence, /nothing here is softer/);
});

test("packs that aren't rated are handled honestly", () => {
  const core = withScores({ "qn-ultra-plush": 9 });
  // The cheapest isn't rated: Balanced can't weigh it, so it keeps the cheapest and says why.
  const unratedCheapest = decide(core, `a=${AS},12,8&b=${QN},12,10&p=balanced`);
  assert.deepEqual([unratedCheapest.reason, unratedCheapest.winners], ["cheapest-unrated", "a"]);
  assert.match(unratedCheapest.sentence, /isn't rated for softness, so Balanced can't weigh it/);
  // Softest leaves unrated packs out and names them on the card.
  const soft = decide(core, `a=${AS},12,8&b=${QN},12,10&p=soft`);
  assert.deepEqual([soft.reason, soft.winners], ["soft", "b"]);
  const { state } = core.parseDeal(new URLSearchParams(`a=${AS},12,8&b=${QN},12,10&p=soft`), true);
  assert.match(core.resultHTML(state, core.computeDeal(state)).html, /Pack A isn't rated for softness, so it's left out\./);
  // Nothing rated: the cheapest, said plainly.
  const none = decide(withScores({}), `a=${AS},12,8&b=custom:300:4x4:2,12,10&p=soft`);
  assert.deepEqual([none.reason, none.winners], ["none-rated", "a"]);
  assert.match(none.sentence, /None of these packs is rated for softness, so this is simply the cheapest per sheet\./);
  // Custom rolls are never rated.
  assert.match(decide(core, `a=custom:300:4x4:2,12,8&b=${QN},12,10&p=balanced`).sentence, /isn't rated for softness/);
});

// ---------- links and the API ----------
const LINK = `/?p=soft&a=${AS},12,8&b=charmin-ultra-soft-mega-xl,6,9.99`;

test("p rides along in calculator links, and the server renders the linked priority", async () => {
  const { state } = Core.parseDeal(new URLSearchParams(LINK.slice(2)), false);
  assert.equal(state.priority, "soft");
  assert.equal(Core.dealLink(state), `${ORIGIN}/?mode=sheets&p=soft&a=${AS},12,8&b=charmin-ultra-soft-mega-xl,6,9.99`);
  assert.equal(Core.dealLink({ ...state, priority: "cheap" }), `${ORIGIN}/?mode=sheets&a=${AS},12,8&b=charmin-ultra-soft-mega-xl,6,9.99`);
  // A priority alone is a link too.
  assert.equal(Core.dealQuery({ ...Core.defaultDeal(), priority: "balanced" }), "mode=sheets&p=balanced");
  const page = await html(LINK);
  assert.match(page, /<input type="radio" name="priority" value="soft" autocomplete="off" checked>/);
  assert.match(page, /<input type="radio" name="judge" value="sheets" autocomplete="off" checked>/);
  const expected = Core.resultSentence(state, Core.computeDeal(state));
  assert.equal(pick(page, /<meta property="og:description" content="([^"]*)">/), expected.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  // A bad p is ignored on pages.
  assert.match(await html(`/?p=fluffiest&a=${AS},12,8`), /<input type="radio" name="priority" value="cheap" autocomplete="off" checked>/);
  // /?p=balanced alone renders that priority on the server.
  assert.match(await html("/?p=balanced"), /<input type="radio" name="priority" value="balanced" autocomplete="off" checked>/);
});

test("/api/compare takes p and reports softness, the winner for it and the cheapest", async () => {
  const q = `a=${AS},12,8&b=charmin-ultra-soft-mega-xl,6,9.99`;
  const cheap = await (await get(`/api/compare?${q}`)).json();
  assert.equal(cheap.priority, "cheap");
  assert.equal(cheap.pickReason, "cheap");
  for (const priority of ["balanced", "soft"]) {
    const res = await get(`/api/compare?p=${priority}&${q}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const { state } = Core.parseDeal(new URLSearchParams(`p=${priority}&${q}`), true);
    const deal = Core.computeDeal(state);
    assert.equal(body.priority, priority);
    assert.equal(body.pickReason, deal.pick.reason);
    assert.deepEqual(body.packs.map((p) => p.softness), deal.results.map((r) => r.soft ? r.soft.score : null));
    assert.deepEqual(body.packs.map((p) => p.best), deal.results.map((r) => deal.pick.winners.includes(r)));
    assert.deepEqual(body.packs.map((p) => p.cheapest), deal.results.map((r) => deal.ranking.winners.includes(r)));
    assert.equal(body.summary, Core.resultSentence(state, deal));
    assert.ok(body.link.includes(`p=${priority}`));
  }
  const bad = await get(`/api/compare?p=fluffiest&${q}`);
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /p must be cheap, balanced or soft/);
});
