// Links in a real browser: a shared link must open exactly what it says, even for a returning
// visitor with an edited calculator, leftover storage and form values the browser restores.
// Runs the built Worker on a local port and drives Chrome with playwright-core. Skipped when
// Chrome isn't installed.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import worker from "../dist-inline/index.js";

const DEAL_LINK = "/?mode=sheets&a=kirkland-signature-bath-tissue,30,24.99&b=charmin-ultra-soft-mega-xl,6,9.99";
const DEAL_PACKS = ["kirkland-signature-bath-tissue,30,24.99", "charmin-ultra-soft-mega-xl,6,9.99"];
const CONV_LINK = "/convert?roll=kirkland-signature-bath-tissue";

let server, base, context, profile, skip = false;

before(async () => {
  server = createServer(async (req, res) => {
    const response = await worker.fetch(new Request("https://toiletpaper.app" + req.url, { method: req.method, headers: req.headers }));
    const headers = Object.fromEntries(response.headers);
    if (headers.location) headers.location = headers.location.replace("https://toiletpaper.app", "");
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  // A persistent profile, so history, storage and form restoration behave like a returning visitor's.
  profile = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "tp-browser-"));
  try {
    context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true });
  } catch {
    skip = true;
  }
});

after(async () => {
  await context?.close();
  server?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
});

const packsOf = (page) => page.$$eval(".pack", (els) => els.map((el) =>
  ["productId", "rolls", "price"].map((k) => el.querySelector(`[data-k="${k}"]`).value).join(",")));
const modeOf = (page, name) => page.$eval(`input[name="${name}"]:checked`, (el) => el.value);

// Before app.js runs, flip the server-rendered controls the way a browser's form restoration
// can (Firefox restores radios and selects on reload and history navigation).
// Each control is flipped once, as it arrives from the parser.
const RESTORE_STALE_FORM = () => {
  const done = new Set();
  const flip = (key, el, apply) => {
    if (!el || done.has(key)) return;
    done.add(key);
    el.dataset.flipped = "1";
    apply(el);
  };
  new MutationObserver(() => {
    for (const name of ["judge", "conv-mode"]) {
      flip(name, document.querySelector(`input[name="${name}"][value="area"]`), (el) => { el.checked = true; });
    }
    flip("pack", document.querySelector('.pack [data-k="productId"]'), (el) => { el.value = "angel-soft-mega"; });
    flip("conv", document.getElementById("conv-select"), (el) => { el.value = "angel-soft-mega"; });
  }).observe(document, { childList: true, subtree: true });
};

test("a shared calculator link wins over everything a returning visitor has", async (t) => {
  if (skip) return t.skip("Chrome isn't installed");
  const page = await context.newPage();
  // A returning visitor: storage from older versions of the site, and their own edited comparison.
  await page.goto(base + "/");
  await page.evaluate(() => {
    localStorage.setItem("tp-paused", "1");
    localStorage.setItem("tp-deal", JSON.stringify({ mode: "area", packs: [{ productId: "angel-soft-mega", rolls: "12", price: "7.77" }] }));
    sessionStorage.setItem("tp-deal", "a=angel-soft-mega,12,7.77");
  });
  await page.selectOption('.pack >> nth=0 >> [data-k="productId"]', "angel-soft-mega");
  await page.fill('.pack >> nth=0 >> [data-k="price"]', "7.77");
  await page.check('input[name="judge"][value="area"]', { force: true });
  await page.waitForFunction(() => location.search.includes("angel-soft-mega"));
  const edited = page.url();

  // Same tab, then a fresh tab: the link's packs and mode, every time.
  await page.goto(base + DEAL_LINK);
  assert.deepEqual(await packsOf(page), DEAL_PACKS);
  assert.equal(await modeOf(page, "judge"), "sheets");
  const fresh = await context.newPage();
  await fresh.goto(base + DEAL_LINK);
  assert.deepEqual(await packsOf(fresh), DEAL_PACKS);
  assert.equal(await modeOf(fresh, "judge"), "sheets");
  assert.match(await fresh.textContent("#deal-result"), /Pack A/);

  // Back still shows the visitor's own edits; forward and reload show the link again.
  await page.goBack();
  assert.equal(page.url(), edited);
  assert.equal((await packsOf(page))[0], "angel-soft-mega,12,7.77");
  await page.goForward();
  assert.deepEqual(await packsOf(page), DEAL_PACKS);
  await page.reload();
  assert.deepEqual(await packsOf(page), DEAL_PACKS);
  assert.equal(await modeOf(page, "judge"), "sheets");

  // Opening a link doesn't change the address until the visitor edits something.
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).search, new URL(base + DEAL_LINK).search);
  await page.close();
  await fresh.close();
});

test("restored form values can't override a calculator or converter link", async (t) => {
  if (skip) return t.skip("Chrome isn't installed");
  const page = await context.newPage();
  await page.addInitScript(RESTORE_STALE_FORM);
  await page.goto(base + DEAL_LINK);
  assert.ok(await page.$eval('input[name="judge"][value="area"]', (el) => el.dataset.flipped === "1"), "the stale value was applied");
  assert.deepEqual(await packsOf(page), DEAL_PACKS);
  assert.equal(await modeOf(page, "judge"), "sheets");
  assert.match(await page.textContent("#deal-result"), /by sheet count/i);

  await page.goto(base + CONV_LINK);
  assert.equal(await page.$eval("#conv-select", (el) => el.value), "kirkland-signature-bath-tissue");
  assert.equal(await modeOf(page, "conv-mode"), "sheets");
  assert.match(await page.textContent("#conv-claim-check"), /^Kirkland Signature/);
  await page.close();
});

test("every tool control opts out of browser form restoration", async () => {
  for (const path of [DEAL_LINK, CONV_LINK]) {
    const html = await (await worker.fetch(new Request("https://toiletpaper.app" + path))).text();
    const controls = html.match(/<(select|input)\b[^>]*>/g);
    assert.ok(controls.length >= 4, path);
    for (const tag of controls) assert.match(tag, /autocomplete="off"/, `${path}: ${tag}`);
  }
});
