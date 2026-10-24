import assert from "node:assert/strict";
import { test } from "node:test";
import { redirectTarget } from "../src/index.ts";

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
