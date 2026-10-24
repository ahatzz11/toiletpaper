// Builds dist-inline/index.js: one ES module Worker that serves the whole site with no bindings
// and no asset upload, so it can be deployed as a plain Worker script.
//
//   npm run build:inline
//
// What goes in:
//   public/            static files (styles, browser scripts, media, icons), inlined as they are
//   src/site/          the HTML pages and generated files (robots.txt, sitemap.xml, llms.txt,
//                      openapi.json, /api/products, ...), rendered here with public/data.js
//                      and public/core.js, the same code the browser runs
//   src/worker.js      request handling, pasted in after data.js, core.js and the file table

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { INDEXNOW_KEY, ORIGIN } from "../src/site/config.mjs";
import { buildFiles } from "../src/site/files.mjs";
import { TOOL_END, TOOL_START, renderPage } from "../src/site/layout.mjs";
import { loadCore } from "../src/site/load.mjs";
import { buildSite } from "../src/site/pages.mjs";
// The www rule lives in src/index.ts. Its source is copied into the output below.
import { APEX, redirectTarget } from "../src/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "public");
const outDir = join(root, "dist-inline");
const outFile = join(outDir, "index.js");
const MAX_BYTES = 3 * 1024 * 1024; // the Worker is uploaded as one module

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt", ".xml", ".webmanifest", ".svg"]);

// CSS, JS, images and media also get a content-hashed path, /styles.<hash>.css, and the HTML
// points only at that. Those paths never change content, so browsers keep them for a year.
const FINGERPRINT = new Set([".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".svg"]);
const FINGERPRINT_EXT = [...FINGERPRINT].map((e) => e.slice(1)).join("|");
const HASH_LENGTH = 10;
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";
const HOUR = "public, max-age=3600";
const DAY = "public, max-age=86400";

// Cache-Control for each file's plain path. HTML and anything the HTML links by plain path
// revalidate on every load, so a deploy never pairs new HTML with old CSS or JS. Files that
// crawlers and browsers fetch by a fixed name are cached for an hour or a day.
function plainCache(path) {
  if (path === "/favicon.ico" || path === "/apple-touch-icon.png") return DAY;
  if (/^\/(?:robots\.txt|sitemap\.xml|llms(?:-full)?\.txt|openapi\.json|site\.webmanifest|api\/products)$/.test(path)) return HOUR;
  if (path === `/${INDEXNOW_KEY}.txt`) return HOUR;
  return REVALIDATE;
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // skip .DS_Store and friends
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

const sha256 = (bytes) => createHash("sha256").update(bytes);

// ---------- static files ----------
const files = [];
for (const file of await listFiles(publicDir)) {
  const ext = extname(file).toLowerCase();
  if (ext === ".html") throw new Error(`${relative(root, file)}: pages are generated from src/site/pages.mjs, not kept in public/`);
  files.push({ ext, path: "/" + relative(publicDir, file).split(sep).join("/"), bytes: await readFile(file) });
}
for (const need of ["/data.js", "/core.js", "/app.js", "/styles.css", "/icon.svg", "/favicon.ico", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"]) {
  if (!files.some((f) => f.path === need)) throw new Error(`public${need} is missing (icons come from npm run media)`);
}

// "/styles.css" -> "/styles.0123456789.css"
const fingerprinted = new Map();
for (const f of files) {
  if (!FINGERPRINT.has(f.ext)) continue;
  const hash = sha256(f.bytes).digest("hex").slice(0, HASH_LENGTH);
  fingerprinted.set(f.path, f.path.slice(0, -f.ext.length) + "." + hash + f.ext);
}
const assetUrl = (path) => {
  const hashed = fingerprinted.get(path);
  if (!hashed) throw new Error(`${path} is not a fingerprinted file in public/`);
  return hashed;
};

// ---------- pages and generated files ----------
const { D, Core, dataSource, coreSource } = loadCore(root);
const site = buildSite(D, Core);
const ctx = { siteDescription: site.siteDescription, footerLinks: site.footerLinks, checked: D.checked, brandList: site.brandList };

// Point every page at the hashed paths, in href, src and meta content (where share tags use
// https://toiletpaper.app/media/share.png). A reference to one of these file types on this site
// that isn't a file in public/ fails the build.
const ASSET_URL = new RegExp(`\\.(?:${FINGERPRINT_EXT})$`, "i");
function rewrite(html, where) {
  return html.replace(/(\s(?:href|src|content)=")([^"]*)"/g, (match, attr, url) => {
    const local = url.startsWith(ORIGIN + "/") ? url.slice(ORIGIN.length) : url;
    if (!ASSET_URL.test(local) || /^[a-z][a-z0-9+.-]*:/i.test(local)) return match; // not an asset, or another site
    const hashed = fingerprinted.get(local);
    if (!hashed) throw new Error(`${where} references ${url}, which is not a file in public/ (use a path like /app.js)`);
    return attr + url.slice(0, url.length - local.length) + hashed + '"';
  });
}

const pages = [];
let notFound = null;
for (const page of site.pages) {
  const html = Buffer.from(rewrite(renderPage(page, ctx), page.path), "utf8");
  const f = { ext: ".html", path: page.path, bytes: html, tool: page.tool || null };
  if (page.key === "notfound") notFound = f;
  else pages.push(f);
}
const generated = buildFiles(D, Core, site, assetUrl).map((g) => ({
  ext: extname(g.path) || ".json",
  path: g.path,
  type: g.type,
  bytes: Buffer.from(g.text, "utf8"),
}));

const seen = new Set();
for (const f of [...files, ...pages, ...generated]) {
  if (seen.has(f.path)) throw new Error(`${f.path} is defined twice`);
  seen.add(f.path);
}

// ---------- the file table ----------
const bodies = [];
function entry(f, path, cache) {
  return { path, cache, ...f.shared };
}
function share(f) {
  const isText = TEXT.has(f.ext);
  f.shared = {
    type: f.type ?? TYPES[f.ext] ?? "application/octet-stream",
    // HTML gets a weak ETag: Cloudflare's edge drops strong ETags from HTML it may rewrite, but keeps weak ones.
    etag: `${f.ext === ".html" ? "W/" : ""}"${sha256(f.bytes).digest("base64url").slice(0, 27)}"`,
    // Text is embedded as a JSON string, binary as base64.
    base64: !isText,
    body: bodies.push(isText ? f.bytes.toString("utf8") : f.bytes.toString("base64")) - 1,
    tool: f.tool ?? null,
  };
}

const entries = [];
for (const f of [...pages, ...files, ...generated]) {
  share(f);
  // The plain path still works (old cached HTML asks for /styles.css), but it revalidates.
  entries.push(entry(f, f.path, f.ext === ".html" ? REVALIDATE : plainCache(f.path)));
  if (fingerprinted.has(f.path)) entries.push(entry(f, fingerprinted.get(f.path), IMMUTABLE));
}
share(notFound);

const fileCall = (e) =>
  `file(${JSON.stringify(e.type)}, ${JSON.stringify(e.cache)}, ${JSON.stringify(e.etag)}, ${e.base64}, ${e.body}${e.tool ? `, ${JSON.stringify(e.tool)}` : ""})`;
const bodiesLiteral = bodies.map((b) => `  ${JSON.stringify(b)},`).join("\n");
const filesLiteral = entries.map((e) => `  [${JSON.stringify(e.path)}, ${fileCall(e)}],`).join("\n");

const workerSource = (await readFile(join(root, "src/worker.js"), "utf8")).replace(/^(?:\/\/.*\n)+\n/, "");

const source = `// Generated by scripts/build-inline.mjs from public/, src/site/ and src/worker.js. Do not edit by hand.
// Serves toiletpaper.app with no bindings and sends www.${APEX} to the apex.

const APEX = ${JSON.stringify(APEX)};

${redirectTarget.toString().replace(/ +\)/g, ")").replace(/\) +\{/g, ") {")}

// ---------- public/data.js ----------
${dataSource.trim()}

// ---------- public/core.js ----------
${coreSource.trim()}

// ---------- files ----------
const TOOL_START = ${JSON.stringify(TOOL_START)};
const TOOL_END = ${JSON.stringify(TOOL_END)};
const HASH_LENGTH = ${HASH_LENGTH};
const FINGERPRINT_EXT = ${JSON.stringify(FINGERPRINT_EXT)};

const BODIES = [
${bodiesLiteral}
];

// Bodies are decoded on first use and shared by a file's plain and hashed paths.
const DECODED = [];
function decode(index, base64) {
  if (DECODED[index]) return DECODED[index];
  const body = BODIES[index];
  let bytes;
  if (base64) {
    const binary = atob(body);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(body);
  }
  return (DECODED[index] = bytes);
}

function file(type, cache, etag, base64, index, tool = null) {
  return { type, cache, etag, tool, bytes: () => decode(index, base64), text: () => BODIES[index] };
}

// Pages and plain paths mostly revalidate (no-cache). Content-hashed paths are immutable.
const FILES = new Map([
${filesLiteral}
]);

const NOT_FOUND = ${fileCall({ ...notFound.shared, cache: REVALIDATE })};

// ---------- src/worker.js ----------
${workerSource}`;

const size = Buffer.byteLength(source);
if (size > MAX_BYTES) throw new Error(`dist-inline/index.js is ${size} bytes, over the 3 MB limit`);

await mkdir(outDir, { recursive: true });
await writeFile(outFile, source);
console.log(`dist-inline/index.js: ${pages.length} pages, ${files.length} static files and ${generated.length} generated files at ${entries.length} paths; ${size} bytes (${(size / 1024).toFixed(1)} KiB)`);
