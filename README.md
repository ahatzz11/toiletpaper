# Toilet Paper Math

A small static site at https://toiletpaper.app for comparing Charmin and Quilted Northern toilet paper, whose roll names (Mega, Mega XL, Super Mega and the rest) don't say how much paper you get.

| Route | Page | Title |
| --- | --- | --- |
| `/` | Deal calculator: pick the packs on the shelf, type the prices, see which costs less | Which toilet paper pack is the better deal? \| Toilet Paper Math |
| `/convert` | Roll converter: what one roll equals in every other roll, with a chart of all rolls | Roll converter: what Mega, Mega XL and Super Mega really mean \| Toilet Paper Math |
| `/about` | How it works: each brand's "regular roll", shrinkflation notes, the sources table | How it works and sources \| Toilet Paper Math |

Both tools compare by sheet count by default. Paper area and area × ply are one click away.

The site is plain HTML, CSS and JavaScript in `public/`, with no framework and no client build step:

- `public/index.html`, `public/convert/index.html`, `public/about/index.html`: one file per page. They share the same header (mascot and nav) and footer, so change all three together.
- `public/app.js`: one script for every page. It only sets up the parts a page contains.
- `public/styles.css`: shared styles.
- `public/data.js`: every roll's sheet count, sheet size, ply and source. Edit numbers here.
- `public/404.html`: the not-found page.

## Commands

```sh
npm install
npm run build:inline   # writes dist-inline/index.js
npm test               # runs build:inline, then the tests in test/
```

`npm run build:inline` runs `scripts/build-inline.mjs`. It reads every file in `public/` and writes one ES module Worker to `dist-inline/index.js` with the files inlined. That Worker has no imports and no bindings, and it serves every route itself:

- `/`, `/convert` and `/about` (with or without a trailing slash) return 200 with that page's `index.html`. `/index`, `/index.html`, `/convert/index.html` and similar get a 301 to the clean route.
- Every other file at its own path, with its Content-Type, an ETag (an `If-None-Match` match gets a 304) and `Cache-Control` (5 minutes for HTML, 1 hour for everything else).
- `404.html` with status 404 for unknown paths.
- Only GET and HEAD. Other methods get a 405.

To add a page, create `public/<name>/index.html`. The build picks it up and the Worker serves it at `/<name>`.

`www.toiletpaper.app` gets a 301 to `https://toiletpaper.app` with the same path and query. The rule lives in `src/index.ts` (`redirectTarget`), and the build copies it into the Worker.

The build fails if the output would reach 1 MB.

`python3 -m http.server` inside `public/` works for a quick look, but it redirects `/convert` to `/convert/`. The Worker serves both with a 200.

## Deploy

What is live:

- One Worker named `toiletpaper` on the Personal Cloudflare account. Its script is `dist-inline/index.js`, uploaded as a single ES module with every file inlined.
- No ASSETS binding and no static-assets upload.
- Custom domains `toiletpaper.app` and `www.toiletpaper.app`. Custom domains handle the certificates, and `.app` is HTTPS only. The Worker itself sends www to the apex with a 301.
- The workers.dev subdomain is disabled.

To deploy a change, run `npm test` (it rebuilds `dist-inline/index.js` and checks it), then use one of these:

- **Cloudflare API.** Upload `dist-inline/index.js` as the `toiletpaper` Worker script (a script PUT with the file as an ES module). Only if the domains change, attach them with `PUT /accounts/{account_id}/workers/domains`.
- **cf CLI.** `cf deploy --profile personal`. It reads `cloudflare.config.ts` (name, both domains, workers.dev off, `dist-inline/index.js` as the entrypoint), and `vite.config.ts` regenerates `dist-inline/index.js` before the build. `cf deploy --dry-run --profile personal` builds without uploading.

`dist-inline/` is not committed. Build it before deploying.

Not affiliated with Charmin or Quilted Northern.
