# Toilet Paper Math

A small site at https://toiletpaper.app for comparing Charmin, Quilted Northern and Angel Soft toilet paper, whose roll names (Mega, Mega XL, Super Mega and the rest) don't say how much paper you get.

| Route | Page |
| --- | --- |
| `/` | Deal calculator: pick the packs on the shelf, type the prices, see which costs less |
| `/convert` | Roll converter: what one roll equals in every other roll, with a chart of all rolls |
| `/about` | How it works, for people: why sheets beat "rolls" in three cards, then a short FAQ (`<details>` accordion, works without JS) |
| `/data` | Data & API: every roll in one table, the sources table, the API with a live example, the link format, and links to llms.txt, llms-full.txt and openapi.json. Linked from the footer, not the nav |
| `/charmin-mega-vs-quilted-northern-mega`, `/how-many-sheets-in-a-mega-roll`, `/cheapest-toilet-paper-per-sheet` | Short guides that answer one question each and link into the tools |
| `/api/products`, `/api/compare` | Read-only JSON API, described in `/openapi.json` |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` | For crawlers and AI assistants |

Both tools compare by sheet count by default. Paper area and area × ply are one click away.

Every page ends with the same one-line footer: "Not affiliated with any brand · Sources · Data & API", linking to `/data#sources` and `/data`. The guides are linked from the `/about` FAQ answers and the 404 page, and listed in the sitemap and llms.txt. Old links to `/about#sources` and `/about#data` land on the matching FAQ answer, which `app.js` opens.

## Data

`public/data.js` holds every number. The rule for sources: **manufacturer numbers beat retailer listings.**

- When the maker's own site or pack photo (charmin.com, quiltednorthern.com, angelsoft.com and other P&G or Georgia-Pacific pages) gives a number, use that value, and list that page first in the product's `sources`.
- Retailer listings (Target, Walmart, Kroger and the like) are a fallback for numbers the maker doesn't publish. Say so in the product's `source` note.
- Label each source link with the numbers it backs, like `charmin.com (sheets, claim)` or `Hannaford (size, pack total)`, so the sources table shows which numbers came from whom.
- A manufacturer record that current packs contradict isn't used, but stays listed with a note. Today that's P&G SmartLabel's Charmin Ultra Soft Mega, Mega XL and Mega XXL records (224, 336 and 440 sheets, last updated 2022). Current packs print 208, 312 and 416, with square-foot totals that match.
- A number computed from other printed numbers is flagged `derived`. A number we couldn't find printed and borrowed from a sibling product is `estimated`. Both show as tags on the site.
- Update `checked` in `data.js` and `UPDATED` in `src/site/config.mjs` when you recheck.

## How it's built

There is no framework and no client build step. Every number comes from one file, and the server and the browser run the same code.

- `public/data.js`: every brand and roll (sheet count, sheet size, ply, the "= N regular" claim, sources with URLs). Edit numbers here. Product ids appear in links and the API, so don't rename them.
- `public/core.js`: the math, the link format and the HTML for both tools. The browser loads it, and the build and the Worker run it too.
- `public/app.js`: browser wiring only: events, keeping the address bar in sync, the background rolls.
- `public/styles.css`, `public/icon.svg` and the icon PNGs, `public/media/`: static files.
- `src/site/pages.mjs`: every page, with copy, tables and FAQ built from `data.js`. `src/site/layout.mjs` wraps them in the shared head, header and footer (meta tags, canonical, JSON-LD, icons). `src/site/files.mjs` writes robots.txt, sitemap.xml, llms.txt, llms-full.txt, openapi.json, the web manifest, `/api/products` and the IndexNow key file. `src/site/config.mjs` holds the origin, the sitemap date (`UPDATED`) and the IndexNow key.
- `src/worker.js`: request handling (routing, caching, ranges, the API, server rendering of linked state).
- `scripts/build-inline.mjs`: renders all of the above and writes one ES module Worker, `dist-inline/index.js`, with every file inlined.

To add a page, add it to `src/site/pages.mjs`. It gets a canonical URL, a sitemap entry and a line in llms.txt.

## Commands

```sh
npm install
npm run build:inline   # writes dist-inline/index.js
npm test               # runs build:inline, then the tests in test/
npm run serve          # serves the built Worker at http://localhost:8787
npm run media          # re-renders public/media/ and the icons (only after changing the scene or icon.svg)
npm run indexnow       # after a deploy: tells IndexNow every URL in the live sitemap
```

## Links that keep state

The calculator keeps its state in the query string and updates it as you type (`history.replaceState`, debounced), so the address bar is always a link to what's on screen. "Copy link" copies it.

```
https://toiletpaper.app/?mode=area&a=charmin-ultra-soft-mega-xl,6,9.99&b=quilted-northern-ultra-soft-strong-mega,12,13.49
```

- `mode`: `sheets`, `area` or `areaply` (`ply` also works).
- `a` to `h`: one pack each, `<product id>,<rolls>,<price>`. The price may be empty. A roll that isn't listed is `custom:<sheets>:<width>x<length>:<ply>`.
- The converter: `/convert?roll=<product id>&mode=area`.

Bad values are dropped and the page falls back to its defaults. The Worker renders linked state on the server too, so the first paint and the link preview (`og:description`) show the linked result. The canonical URL never includes the query.

## API

Read-only, open CORS (`Access-Control-Allow-Origin: *`, OPTIONS preflight), GET and HEAD only (anything else gets a 405 JSON error).

- `GET /api/products`: every brand and roll. Cached for an hour, with an ETag.
- `GET /api/compare?mode=sheets&a=<id>,<rolls>,<price>&b=...`: 2 to 8 packs. Returns the price per 100 sheets, per sq ft and per sq ft × ply for each pack, the winner (or a tie), the percent differences, a one-line summary and a link to the same comparison in the calculator. Cached for 5 minutes. Bad input gets a 400 with a JSON `error`.

`/openapi.json` describes both (OpenAPI 3.1).

## Serving and caching

The Worker serves every route itself, with no bindings:

- Pages at clean paths. A trailing slash, `/index` or `/index.html` gets a 301 to the clean path. Unknown paths get the 404 page (noindex, with links to the tools and guides).
- Every file has its Content-Type and an ETag (an `If-None-Match` match gets a 304). HTML ETags are weak (`W/"..."`), because Cloudflare's edge strips strong ETags from HTML but keeps weak ones. `If-None-Match` matches weak and strong forms either way. `If-Range` needs a strong ETag, so it only works on static files.
- CSS, JS, images and video are also served at a content-hashed path, like `/styles.<hash>.css`. The hash is the first 10 hex characters of the file's SHA-256. The build rewrites every `href`, `src` and meta `content` that points at one of these files to the hashed path. A reference it can't rewrite fails the build.
- Byte ranges on every file, which video players need: one `Range: bytes=a-b`, `a-` or `-n` gets a 206. A range past the end gets a 416. Several ranges or a malformed header get the whole file.
- `www.toiletpaper.app` gets a 301 to the apex with the same path and query. The rule is `redirectTarget` in `src/index.ts`, which the build copies in.

| What | Cache-Control |
| --- | --- |
| Hashed files | `public, max-age=31536000, immutable` |
| robots.txt, sitemap.xml, llms.txt, llms-full.txt, openapi.json, site.webmanifest, the IndexNow key, `/api/products` | `public, max-age=3600` |
| `/favicon.ico`, `/apple-touch-icon.png` | `public, max-age=86400` |
| `/api/compare` | `public, max-age=300` |
| HTML, the 404 page and other plain paths | `no-cache` (revalidated with the ETag) |

The plain paths (`/styles.css`) still serve the current file for old cached HTML. A hash from an older deploy also gets the current file, with `no-cache`.

Each page's inline `<style>` and the mascot's `width` and `height` keep the header small if `styles.css` fails to load.

The build fails if the output would reach 3 MB. Most of the size is the base64 video, so keep `share.mp4` small.

## Search, previews and AI assistants

- Every page has its own title and description, an absolute canonical, Open Graph and Twitter tags, `theme-color`, and icons (SVG, ICO, apple-touch-icon, a web manifest with 192 and 512 PNGs).
- JSON-LD: `WebSite` on every page, `WebApplication` on the two tools, `BreadcrumbList` on subpages, and `FAQPage` on `/about`, built from the same list as the visible FAQ. A test checks that they match.
- robots.txt allows everything, with an explicit group for each major search and AI crawler, and points at the sitemap.
- llms.txt is a short Markdown guide to the site, the API and the link format, and points to `/data`. llms-full.txt adds the full roll table, the method and the FAQ.
- The share preview is `public/media/share.png` (1200x630) and an 8 second looping video, `share.mp4`. `npm run media` renders both from `scripts/share-media/scene.html`, which uses the site's own background rolls. Frame 0 of the video is the image. There is no `twitter:player` card, because it needs a separate HTTPS player page for an iframe and would replace the large image card.
- The background rolls animate with transforms only, pause while the tab is hidden, and don't render at all with `prefers-reduced-motion`.

### IndexNow

The key is in `src/site/config.mjs` and served at `/<key>.txt`. It is public by design (search engines fetch it to confirm ownership), so secrets scans should skip it. After a deploy, `npm run indexnow` checks the live key file, reads the live sitemap and posts its URLs to `https://api.indexnow.org/indexnow`.

## Deploy

What is live:

- One Worker named `toiletpaper` on the Personal Cloudflare account. Its script is `dist-inline/index.js`, uploaded as a single ES module with every file inlined.
- No bindings and no static-assets upload.
- Custom domains `toiletpaper.app` and `www.toiletpaper.app`. The Worker itself sends www to the apex with a 301.
- The workers.dev subdomain is disabled.

To deploy a change, run `npm test` (it rebuilds `dist-inline/index.js` and checks it), then use one of these:

- **Cloudflare API.** Upload `dist-inline/index.js` as the `toiletpaper` Worker script (a script PUT with the file as an ES module). Only if the domains change, attach them with `PUT /accounts/{account_id}/workers/domains`.
- **cf CLI.** `cf deploy --profile personal`. It reads `cloudflare.config.ts`, and `vite.config.ts` regenerates `dist-inline/index.js` before the build. `cf deploy --dry-run --profile personal` builds without uploading.

`dist-inline/` is not committed. Build it before deploying.

Not affiliated with Charmin, Quilted Northern or Angel Soft.
