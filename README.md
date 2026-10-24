# Toilet Paper Math

A small static site at https://toiletpaper.app for comparing Charmin and Quilted Northern toilet paper, whose roll names (Mega, Mega XL, Super Mega and the rest) don't say how much paper you get.

| Route | Page | Title |
| --- | --- | --- |
| `/` | Deal calculator: pick the packs on the shelf, type the prices, see which costs less | Which toilet paper pack is the better deal? \| Toilet Paper Math |
| `/convert` | Roll converter: what one roll equals in every other roll, with a chart of all rolls | Roll converter: what Mega, Mega XL and Super Mega really mean \| Toilet Paper Math |
| `/about` | How it works: each brand's "regular roll", shrinkflation notes, the sources table | How it works and sources \| Toilet Paper Math |

Both tools compare by sheet count by default. Paper area and area × ply are one click away.

The site is plain HTML, CSS and JavaScript in `public/`, with no framework and no client build step:

- `public/index.html`, `public/convert/index.html`, `public/about/index.html`: one file per page. They share the same header (mascot and nav), footer and small inline `<style>` with fallback header styles, so change all four HTML files together (including `404.html`).
- `public/app.js`: one script for every page. It only sets up the parts a page contains.
- `public/styles.css`: shared styles.
- `public/data.js`: every roll's sheet count, sheet size, ply and source. Edit numbers here.
- `public/404.html`: the not-found page.
- `public/media/share.png` and `public/media/share.mp4`: the link preview image (1200x630) and a 6 second looping video of the mascot. `npm run media` renders both from `scripts/share-media/scene.html` with Chrome (via playwright-core) and ffmpeg. Frame 0 of the video is the image.

Every page has Open Graph and Twitter tags for the preview: `og:image` (with type, size and alt), `og:video` (with `secure_url`, type and size), and `twitter:card` set to `summary_large_image`. There is no `twitter:player` card, because it needs a separate HTTPS player page for an iframe and would replace the large image card.

## Commands

```sh
npm install
npm run build:inline   # writes dist-inline/index.js
npm test               # runs build:inline, then the tests in test/
npm run media          # re-renders public/media/ (only after changing the scene)
```

`npm run build:inline` runs `scripts/build-inline.mjs`. It reads every file in `public/` and writes one ES module Worker to `dist-inline/index.js` with the files inlined (text as strings, images and video as base64). That Worker has no imports and no bindings, and it serves every route itself:

- `/`, `/convert` and `/about` (with or without a trailing slash) return 200 with that page's `index.html`. `/index`, `/index.html`, `/convert/index.html` and similar get a 301 to the clean route.
- Every other file at its own path, with its Content-Type and an ETag (an `If-None-Match` match gets a 304). HTML ETags are weak (`W/"..."`), because Cloudflare's edge strips strong ETags from HTML but keeps weak ones. `If-None-Match` matches weak and strong forms either way. `If-Range` needs a strong ETag, so it only works on CSS, JS and media.
- CSS, JS, images and video also at a content-hashed path, like `/styles.<hash>.css` or `/media/share.<hash>.mp4`. The hash is the first 10 hex characters of the file's SHA-256. The build rewrites every `href`, `src` and meta `content` that points at one of these files (as `/path` or `https://toiletpaper.app/path`) to the hashed path. A reference it can't rewrite fails the build.
- Byte ranges on every file (`Accept-Ranges: bytes`), which video players need: one `Range: bytes=a-b`, `a-` or `-n` gets a 206 with `Content-Range`. A range past the end gets a 416 with `Content-Range: bytes */<size>`. Several ranges, a malformed header, or an `If-Range` that doesn't match the ETag get the whole file.
- `404.html` with status 404 for unknown paths.
- Only GET and HEAD. Other methods get a 405.

Caching, so a deploy never mixes new HTML with old CSS or JS:

| What | Cache-Control |
| --- | --- |
| Hashed files (`/styles.<hash>.css`, `/app.<hash>.js`, `/data.<hash>.js`, `/media/share.<hash>.png`, `/media/share.<hash>.mp4`) | `public, max-age=31536000, immutable` |
| HTML, the 404 page, and the plain paths (`/styles.css`, `/media/share.mp4` and so on) | `no-cache` (revalidated with the ETag on every load) |

The plain paths still serve the current files for old cached HTML. A hash from an older deploy also gets the current file, with `no-cache`.

Each page's inline `<style>` and the mascot's `width` and `height` attributes keep the header small if `styles.css` fails to load. The fallback rules use `:where()`, so `styles.css` always overrides them.

To add a page, create `public/<name>/index.html`. The build picks it up and the Worker serves it at `/<name>`.

`www.toiletpaper.app` gets a 301 to `https://toiletpaper.app` with the same path and query. The rule lives in `src/index.ts` (`redirectTarget`), and the build copies it into the Worker.

The build fails if the output would reach 3 MB. Most of the size is the base64 video, so keep `share.mp4` small.

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
