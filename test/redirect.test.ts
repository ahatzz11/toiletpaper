import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { redirectTarget } from "../src/index.ts";

test("www redirects to the apex with the same path and query", () => {
  assert.equal(redirectTarget("https://www.toiletpaper.app/"), "https://toiletpaper.app/");
  assert.equal(redirectTarget("https://www.toiletpaper.app/styles.css"), "https://toiletpaper.app/styles.css");
  assert.equal(redirectTarget("https://www.toiletpaper.app/a/b?x=1&y=two#frag"), "https://toiletpaper.app/a/b?x=1&y=two");
  assert.equal(redirectTarget("http://www.toiletpaper.app/deals?p=1"), "https://toiletpaper.app/deals?p=1");
});

test("apex and other hosts are not redirected", () => {
  assert.equal(redirectTarget("https://toiletpaper.app/"), null);
  assert.equal(redirectTarget("https://toiletpaper.app/app.js?v=2"), null);
  assert.equal(redirectTarget("https://toiletpaper.example.workers.dev/"), null);
});

test("fetch returns a 301 for www and passes apex requests to ASSETS", async () => {
  const seen: string[] = [];
  const env = { ASSETS: { fetch: async (r: Request) => { seen.push(r.url); return new Response("asset"); } } } as any;

  const www = await worker.fetch(new Request("https://www.toiletpaper.app/app.js?v=1"), env);
  assert.equal(www.status, 301);
  assert.equal(www.headers.get("location"), "https://toiletpaper.app/app.js?v=1");
  assert.deepEqual(seen, []);

  const apex = await worker.fetch(new Request("https://toiletpaper.app/app.js?v=1"), env);
  assert.equal(apex.status, 200);
  assert.equal(await apex.text(), "asset");
  assert.deepEqual(seen, ["https://toiletpaper.app/app.js?v=1"]);
});
