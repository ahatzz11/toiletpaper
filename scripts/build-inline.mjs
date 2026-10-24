// Builds dist-inline/index.js: one ES module Worker with every file in public/ inlined.
// It needs no bindings and no asset upload, so it can be deployed as a plain Worker script.
//
//   npm run build:inline

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
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

// CSS, JS and media also get a content-hashed path, /styles.<hash>.css, and the HTML points only
// at that. Those paths never change content, so browsers can keep them for a year. Everything
// else, HTML included, revalidates with its ETag on every load, so a deploy can never pair new
// HTML with old CSS or JS from a browser cache.
const FINGERPRINT = new Set([".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4"]);
const FINGERPRINT_EXT = [...FINGERPRINT].map((e) => e.slice(1)).join("|");
const HASH_LENGTH = 10;
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";

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

const files = [];
for (const file of await listFiles(publicDir)) {
  const ext = extname(file).toLowerCase();
  files.push({ ext, path: "/" + relative(publicDir, file).split(sep).join("/"), bytes: await readFile(file) });
}

if (!files.some((f) => f.path === "/index.html")) throw new Error("public/index.html is missing");
if (!files.some((f) => f.path === "/404.html")) throw new Error("public/404.html is missing");

// "/styles.css" -> "/styles.0123456789.css"
const fingerprinted = new Map();
for (const f of files) {
  if (!FINGERPRINT.has(f.ext)) continue;
  const hash = sha256(f.bytes).digest("hex").slice(0, HASH_LENGTH);
  fingerprinted.set(f.path, f.path.slice(0, -f.ext.length) + "." + hash + f.ext);
}

// Point every HTML page at the hashed paths, in href, src and meta content (where share tags use
// https://toiletpaper.app/media/share.png). A reference to one of these file types on this site
// that can't be rewritten fails the build.
const ORIGIN = `https://${APEX}`;
const ASSET_URL = new RegExp(`\\.(?:${FINGERPRINT_EXT})$`, "i");
for (const f of files) {
  if (f.ext !== ".html") continue;
  const html = f.bytes.toString("utf8").replace(/(\s(?:href|src|content)=")([^"]*)"/g, (match, attr, url) => {
    const local = url.startsWith(ORIGIN + "/") ? url.slice(ORIGIN.length) : url;
    if (!ASSET_URL.test(local) || /^[a-z][a-z0-9+.-]*:/i.test(local)) return match; // not an asset, or another site
    const hashed = fingerprinted.get(local);
    if (!hashed) throw new Error(`${f.path} references ${url}, which is not a file in public/ (use a path like /app.js)`);
    return attr + url.slice(0, url.length - local.length) + hashed + '"';
  });
  f.bytes = Buffer.from(html, "utf8");
}

const bodies = [];
const entries = [];
for (const f of files) {
  const isText = TEXT.has(f.ext);
  const body = bodies.push(isText ? f.bytes.toString("utf8") : f.bytes.toString("base64")) - 1;
  const shared = {
    type: TYPES[f.ext] ?? "application/octet-stream",
    etag: `"${sha256(f.bytes).digest("base64url").slice(0, 27)}"`,
    // Text is embedded as a JSON string, binary as base64.
    base64: !isText,
    body,
  };
  // The plain path still works (old cached HTML asks for /styles.css), but it always revalidates.
  entries.push({ ...shared, path: f.path, cache: REVALIDATE });
  if (fingerprinted.has(f.path)) entries.push({ ...shared, path: fingerprinted.get(f.path), cache: IMMUTABLE });
}

const bodiesLiteral = bodies.map((b) => `  ${JSON.stringify(b)},`).join("\n");
const filesLiteral = entries
  .map((e) => `  [${JSON.stringify(e.path)}, file(${JSON.stringify(e.type)}, ${JSON.stringify(e.cache)}, ${JSON.stringify(e.etag)}, ${e.base64}, ${e.body})],`)
  .join("\n");

const source = `// Generated by scripts/build-inline.mjs from public/. Do not edit by hand.
// Serves the site with no bindings and sends www.${APEX} to the apex.

const APEX = ${JSON.stringify(APEX)};

${redirectTarget.toString().replace(/ +\)/g, ")").replace(/\) +\{/g, ") {")}

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

function file(type, cache, etag, base64, index) {
  return { type, cache, etag, bytes: () => decode(index, base64) };
}

// HTML and plain paths revalidate (${REVALIDATE}). Content-hashed CSS and JS paths are immutable.
const FILES = new Map([
${filesLiteral}
]);

const NOT_FOUND = FILES.get("/404.html");

// "/" and "/convert" (or "/convert/") serve the index.html in that folder. Files serve at their own path.
// A hash from an older deploy (/styles.<old>.css) gets the current file, with no-cache instead of immutable.
function lookup(path) {
  if (path === "/404.html") return null;
  if (path.endsWith("/")) return FILES.get(path + "index.html") ?? null;
  const found = FILES.get(path) ?? FILES.get(path + "/index.html");
  if (found) return found;
  const stale = /^(.+)\\.[0-9a-f]{${HASH_LENGTH}}(\\.(?:${FINGERPRINT_EXT}))$/.exec(path);
  return (stale && FILES.get(stale[1] + stale[2])) ?? null;
}

function etagMatches(header, etag) {
  if (!header) return false;
  return header.split(",").some((tag) => {
    const t = tag.trim();
    return t === "*" || t === etag || t === "W/" + etag;
  });
}

// One "bytes=a-b", "bytes=a-" or "bytes=-n" range. Returns [first, last], "unsatisfiable", or
// null when the header should be ignored (malformed or several ranges) and the whole file sent.
function parseRange(header, size) {
  const m = /^bytes=(\\d*)-(\\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    return suffix === 0 || size === 0 ? "unsatisfiable" : [Math.max(0, size - suffix), size - 1];
  }
  const first = Number(m[1]);
  if (first >= size) return "unsatisfiable";
  const last = m[2] === "" ? size - 1 : Number(m[2]);
  if (last < first) return null;
  return [first, Math.min(last, size - 1)];
}

function respond(request, entry, status) {
  let bytes = entry.bytes();
  const headers = new Headers({
    "Content-Type": entry.type,
    "Cache-Control": status === 404 ? "${REVALIDATE}" : entry.cache,
    "X-Content-Type-Options": "nosniff",
  });
  if (status === 200) {
    headers.set("ETag", entry.etag);
    headers.set("Accept-Ranges", "bytes");
    if (etagMatches(request.headers.get("If-None-Match"), entry.etag)) {
      headers.delete("Content-Type");
      return new Response(null, { status: 304, headers });
    }
    const range = request.headers.get("Range");
    const ifRange = request.headers.get("If-Range");
    if (range && (!ifRange || ifRange === entry.etag)) {
      const size = bytes.byteLength;
      const r = parseRange(range, size);
      if (r === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": \`bytes */\${size}\`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        });
      }
      if (r) {
        status = 206;
        bytes = bytes.subarray(r[0], r[1] + 1);
        headers.set("Content-Range", \`bytes \${r[0]}-\${r[1]}/\${size}\`);
      }
    }
  }
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(request.method === "HEAD" ? null : bytes, { status, headers });
}

export default {
  async fetch(request) {
    const target = redirectTarget(request.url);
    if (target) return Response.redirect(target, 301);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed\\n", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
      });
    }

    const url = new URL(request.url);
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // Malformed escapes fall through to the 404 page.
    }

    // /index, /index.html, /convert/index.html and so on are the same pages as /, /convert.
    let base = null;
    if (path.endsWith("/index.html")) base = path.slice(0, -"index.html".length);
    else if (path.endsWith("/index")) base = path.slice(0, -"index".length);
    if (base !== null && FILES.has(base + "index.html")) {
      const location = base === "/" ? "/" : base.slice(0, -1);
      return new Response(null, { status: 301, headers: { Location: location + url.search } });
    }

    const entry = lookup(path);
    return entry ? respond(request, entry, 200) : respond(request, NOT_FOUND, 404);
  },
};
`;

const size = Buffer.byteLength(source);
if (size > MAX_BYTES) throw new Error(`dist-inline/index.js is ${size} bytes, over the 3 MB limit`);

await mkdir(outDir, { recursive: true });
await writeFile(outFile, source);
console.log(`dist-inline/index.js: ${files.length} files inlined, served at ${entries.map((e) => e.path).join(", ")}; ${size} bytes (${(size / 1024).toFixed(1)} KiB)`);
