// Tells IndexNow (Bing, Yandex, Seznam, Naver and others) that every page in the sitemap
// changed. Run it after a deploy, once the new pages are live:
//
//   npm run indexnow
//
// The key file /<key>.txt must already be served by the live site. Uses only Node built-ins.

import { INDEXNOW_KEY, ORIGIN } from "../src/site/config.mjs";

const host = new URL(ORIGIN).host;
const keyLocation = `${ORIGIN}/${INDEXNOW_KEY}.txt`;

const key = await fetch(keyLocation);
if (!key.ok || (await key.text()).trim() !== INDEXNOW_KEY) {
  console.error(`${keyLocation} doesn't serve the key yet. Deploy first.`);
  process.exit(1);
}

const sitemap = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) {
  console.error("No URLs found in the live sitemap.xml.");
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
for (const url of urlList) console.log(`  ${url}`);
// 200 and 202 both mean accepted.
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
