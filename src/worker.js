// The Worker's request handling. scripts/build-inline.mjs pastes this file into
// dist-inline/index.js after the definitions it uses: APEX, redirectTarget, TP_DATA and TPCore
// (public/data.js and public/core.js), FILES (path -> file), NOT_FOUND (the 404 page), TOOL_START,
// TOOL_END, HASH_LENGTH and FINGERPRINT_EXT. It isn't a module on its own.

const API_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "ETag, Content-Length",
};
const API_METHODS = "GET, HEAD, OPTIONS";
const COMPARE_CACHE = "public, max-age=300";

// A hash from an older deploy (/styles.<old>.css) gets the current file, with no-cache instead of immutable.
const STALE = new RegExp(`^(.+)\\.[0-9a-f]{${HASH_LENGTH}}(\\.(?:${FINGERPRINT_EXT}))$`);
function lookup(path) {
  const found = FILES.get(path);
  if (found) return found;
  const stale = STALE.exec(path);
  const current = stale && FILES.get(stale[1] + stale[2]);
  return current ? { ...current, cache: "no-cache" } : null;
}

// If-None-Match uses weak comparison: W/"x" and "x" match each other.
function etagMatches(header, etag) {
  if (!header) return false;
  const opaque = (tag) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag));
}

// One "bytes=a-b", "bytes=a-" or "bytes=-n" range. Returns [first, last], "unsatisfiable", or
// null when the header should be ignored (malformed or several ranges) and the whole file sent.
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
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

function respond(request, entry, status, extra = {}) {
  let bytes = entry.bytes();
  const headers = new Headers({
    "Content-Type": entry.type,
    "Cache-Control": status === 404 ? "no-cache" : entry.cache,
    "X-Content-Type-Options": "nosniff",
    ...extra,
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
    // If-Range needs a strong match, so a weak ETag never satisfies it and the whole file is sent.
    if (range && (!ifRange || (ifRange === entry.etag && !entry.etag.startsWith("W/")))) {
      const size = bytes.byteLength;
      const r = parseRange(range, size);
      if (r === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { ...extra, "Content-Range": `bytes */${size}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        });
      }
      if (r) {
        status = 206;
        bytes = bytes.subarray(r[0], r[1] + 1);
        headers.set("Content-Range", `bytes ${r[0]}-${r[1]}/${size}`);
      }
    }
  }
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(request.method === "HEAD" ? null : bytes, { status, headers });
}

function textResponse(request, status, type, text, headers) {
  const bytes = new TextEncoder().encode(text);
  return new Response(request.method === "HEAD" ? null : bytes, {
    status,
    headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength), "X-Content-Type-Options": "nosniff", ...headers },
  });
}

function json(request, status, value, cache) {
  return textResponse(request, status, "application/json; charset=utf-8", JSON.stringify(value, null, 2) + "\n", {
    ...API_CORS,
    "Cache-Control": cache,
  });
}

// ---------- /api ----------
function api(request, url, path) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...API_CORS,
        "Access-Control-Allow-Methods": API_METHODS,
        "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type",
        "Access-Control-Max-Age": "86400",
        Allow: API_METHODS,
      },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    const res = json(request, 405, { error: `Method ${request.method} not allowed. This API is read-only: use GET.` }, "no-store");
    res.headers.set("Allow", API_METHODS);
    return res;
  }
  if (path === "/api") {
    return json(request, 200, {
      name: "Toilet Paper Math API",
      docs: TPCore.ORIGIN + "/openapi.json",
      endpoints: {
        products: TPCore.ORIGIN + "/api/products",
        compare: TPCore.ORIGIN + "/api/compare?mode=sheets&a=<product id>,<rolls>,<price>&b=<product id>,<rolls>,<price>",
      },
    }, "public, max-age=3600");
  }
  if (path === "/api/compare") {
    const { state, problems, linked } = TPCore.parseDeal(url.searchParams, true);
    if (problems.length) return json(request, 400, { error: problems[0].message, problems }, "no-store");
    if (!linked || state.packs.length < 2) {
      return json(request, 400, {
        error: "Give at least 2 packs, like ?a=charmin-ultra-soft-mega,6,9.99&b=quilted-northern-ultra-plush-mega,6,8.99. Product ids are listed at " + TPCore.ORIGIN + "/api/products.",
      }, "no-store");
    }
    return json(request, 200, TPCore.compareJSON(state), COMPARE_CACHE);
  }
  const entry = FILES.get(path);
  if (entry) return respond(request, entry, 200, API_CORS);
  return json(request, 404, { error: "No such endpoint. See " + TPCore.ORIGIN + "/openapi.json." }, "no-cache");
}

// ---------- pages with state in the query string ----------
// /?mode=area&a=... and /convert?roll=... render the linked result on the server, so the first
// paint (and a link preview) already shows it. The page around it is the static one.
function withTool(entry, html, description) {
  let page = entry.text();
  const start = page.indexOf(TOOL_START);
  const end = page.indexOf(TOOL_END);
  if (start < 0 || end < start) return null;
  page = page.slice(0, start + TOOL_START.length) + html + page.slice(end);
  if (description) page = TPCore.setShareDescription(page, description);
  return page;
}

function linkedPage(request, url, path, entry) {
  if (!url.search) return null;
  let page = null;
  if (path === "/") {
    const { state, linked } = TPCore.parseDeal(url.searchParams, false);
    if (!linked && state.mode === TPCore.DEFAULT_MODE && state.priority === TPCore.DEFAULT_PRIORITY) return null;
    const deal = TPCore.computeDeal(state);
    page = withTool(entry, TPCore.dealHTML(state), linked ? TPCore.resultSentence(state, deal) : null);
  } else if (path === "/convert") {
    const { state, linked } = TPCore.parseConverter(url.searchParams);
    if (!linked) return null;
    page = withTool(entry, TPCore.converterHTML(state), null);
  }
  if (page == null) return null;
  return textResponse(request, 200, entry.type, page, { "Cache-Control": "no-cache" });
}

// ---------- the site ----------
export default {
  async fetch(request) {
    const target = redirectTarget(request.url);
    if (target) return Response.redirect(target, 301);

    const url = new URL(request.url);
    const raw = url.pathname;
    if (raw === "/api" || raw.startsWith("/api/")) {
      if (raw.length > 4 && raw.endsWith("/")) return Response.redirect(url.origin + raw.replace(/\/+$/, "") + url.search, 301);
      return api(request, url, raw);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed\n", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
      });
    }

    // One address per page: /convert/, /convert/index.html and /index all 301 to the clean path.
    // Leading slashes collapse so //example.com/ can't become a redirect to another site.
    let clean = raw.replace(/\/index(?:\.html)?$/, "/");
    if (clean.length > 1) clean = clean.replace(/\/+$/, "");
    clean = "/" + clean.replace(/^\/+/, "");
    if (clean !== raw && FILES.has(clean)) {
      return new Response(null, { status: 301, headers: { Location: clean + url.search } });
    }

    let path = raw;
    try {
      path = decodeURIComponent(raw);
    } catch {
      // Malformed escapes fall through to the 404 page.
    }
    const entry = lookup(path);
    if (!entry) return respond(request, NOT_FOUND, 404);
    if (entry.tool) {
      const linked = linkedPage(request, url, path, entry);
      if (linked) return linked;
    }
    return respond(request, entry, 200);
  },
};
