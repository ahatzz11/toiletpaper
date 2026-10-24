// Toilet Paper Math shared logic: the math, deep links, and the HTML for both tools.
// The browser loads it as /core.js after /data.js. The Worker inlines it to render deep links and
// answer the API, and the build uses it for every static page, so all three always agree.
var TPCore = (function (D) {
  "use strict";

  var ORIGIN = "https://toiletpaper.app";
  var PRODUCTS = D.products;
  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var BRAND_KEYS = Object.keys(D.brands);
  // Brands with their own "= N regular rolls" yardstick. Other brands are measured in these.
  var CLAIM_BRANDS = BRAND_KEYS.filter(function (b) { return D.brands[b].regularId; });
  var MAX_PACKS = 8;
  var LETTERS = "ABCDEFGH";
  var PARAMS = "abcdefgh";

  // ---------- math ----------
  function sqFtOf(spec) { return (spec.sheets * spec.width * spec.length) / 144; }
  function plyFtOf(spec) { return sqFtOf(spec) * spec.ply; }
  function honestOf(spec) { return sqFtOf(spec) / D.honestRollSqFt; }
  // A brand's "= N regular rolls" yardstick. Null for a brand that makes no such claim (Kirkland).
  function regularOf(brand) { return D.brands[brand].regularId ? byId[D.brands[brand].regularId] : null; }

  // The three ways to compare. Sheets is the default everywhere.
  var MODES = {
    sheets: { name: "sheet count", label: "Sheets", perRoll: function (p) { return p.sheets; }, unit: "sheets", column: "Sheets per roll", per: "per sheet",
      help: "Price per sheet. Simple, though sheet sizes differ a little between brands." },
    area: { name: "paper area", label: "Paper area", perRoll: sqFtOf, unit: "sq ft", column: "Sq ft per roll", per: "per square foot",
      help: "Price per square foot of paper. Bigger sheets count for more." },
    areaply: { name: "area × ply", label: "Area × ply", perRoll: plyFtOf, unit: "sq ft × ply", column: "Sq ft × ply", per: "per square foot of ply",
      help: "Price per square foot, with a 3-ply sheet counting 1.5 times a 2-ply sheet." },
  };
  var MODE_KEYS = ["sheets", "area", "areaply"];
  var DEFAULT_MODE = "sheets";

  // ---------- softness ----------
  var SOFT = D.softness;
  // A product's softness line ({ name, score, sources, why }), or null when it isn't rated:
  // custom rolls, regular-roll yardsticks and lines without a good source.
  function softnessOf(productId) {
    var p = byId[productId];
    var line = p && p.soft ? SOFT.lines[p.soft] : null;
    return line && line.score != null ? line : null;
  }
  function softText(line) { return line ? line.score + "/" + SOFT.max : "not rated"; }

  // What matters more in the calculator. Cheapest is the default and ignores softness.
  // Balanced pays up to BALANCE_STEP more per unit for each point of softness over the cheapest
  // pack: 2 points softer may cost up to 20% more.
  var BALANCE_STEP = 0.1;
  var PRIORITIES = {
    cheap: { label: "Cheapest", name: "cheapest" },
    balanced: { label: "Balanced", name: "balanced" },
    soft: { label: "Softest", name: "softest" },
  };
  var PRIORITY_KEYS = ["cheap", "balanced", "soft"];
  var DEFAULT_PRIORITY = "cheap";
  function priorityHelp(priority, mode) {
    if (priority === "balanced") return "Pays up to " + pct(BALANCE_STEP) + " more " + MODES[mode].per + " for each point of softness (out of " + SOFT.max + ").";
    if (priority === "soft") return "The softest rated pack wins. Price breaks ties.";
    return "Lowest price wins. Softness doesn't count.";
  }

  // ---------- formatting ----------
  function fix(n, d) {
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(n) { return "$" + fix(n, 2); }
  function pct(n) { return Math.round(n * 100) + "%"; }
  function round(n, d) { var f = Math.pow(10, d); return Math.round(n * f) / f; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function brandName(p) { return D.brands[p.brand].name; }
  function shortName(p) { return D.brands[p.brand].short + " " + p.name; }
  function fullName(p) { return D.brands[p.brand].name + " " + p.name; }
  function sizeText(spec) { return spec.width + " × " + spec.length + " in"; }
  function tag(kind) { return ' <span class="tag tag-' + kind + '">' + esc(kind) + "</span>"; }

  function num(str) {
    if (str == null) return NaN;
    var s = String(str).replace(/[$,\s]/g, "");
    if (s === "") return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  // ======================================================
  // Deep links
  // ======================================================
  // Deal calculator: /?mode=sheets&a=<product id>,<rolls>,<price>&b=...
  //   a to h are packs A to H. The price may be empty. A roll that isn't listed is
  //   custom:<sheets>:<width>x<length>:<ply>, for example custom:300:4x3.9:2,12,15.99
  // Roll converter: /convert?roll=<product id>&mode=area
  // Bad values are dropped (pages) or reported (API), never guessed.

  function parsePriority(value, problems) {
    if (value == null || value === "") return DEFAULT_PRIORITY;
    var v = String(value).toLowerCase();
    v = { cheapest: "cheap", price: "cheap", balance: "balanced", softest: "soft" }[v] || v;
    if (PRIORITIES[v]) return v;
    problems.push({ param: "p", message: "p must be cheap, balanced or soft, not \"" + String(value).slice(0, 40) + "\"." });
    return DEFAULT_PRIORITY;
  }

  function parseMode(value, problems) {
    if (value == null || value === "") return DEFAULT_MODE;
    var v = String(value).toLowerCase();
    if (v === "ply") v = "areaply";
    if (MODES[v]) return v;
    problems.push({ param: "mode", message: "mode must be sheets, area or areaply, not \"" + String(value).slice(0, 40) + "\"." });
    return DEFAULT_MODE;
  }

  var CUSTOM = /^custom:(\d{1,5}):(\d{1,2}(?:\.\d{1,3})?)x(\d{1,2}(?:\.\d{1,3})?):(\d)$/;

  // One pack from "id,rolls,price". Returns { pack } or { error }.
  function parsePack(raw, param, needPrice) {
    var parts = String(raw).split(",");
    var where = "Pack " + param;
    if (parts.length < 2 || parts.length > 3) return { error: where + " should look like <product id>,<rolls>,<price>." };
    var id = parts[0].trim();
    var pack = { productId: id, rolls: "", price: "" };
    var spec;
    var m = CUSTOM.exec(id);
    if (m) {
      spec = { sheets: Number(m[1]), width: Number(m[2]), length: Number(m[3]), ply: Number(m[4]) };
      if (!(spec.sheets >= 1 && spec.sheets <= 5000 && spec.width >= 0.5 && spec.width <= 12 && spec.length >= 0.5 && spec.length <= 12 && spec.ply >= 1 && spec.ply <= 6)) {
        return { error: where + ": custom roll numbers are out of range (sheets 1 to 5000, sheet sides 0.5 to 12 in, ply 1 to 6)." };
      }
      pack.productId = "custom";
      pack.custom = { sheets: String(spec.sheets), width: String(spec.width), length: String(spec.length), ply: String(spec.ply) };
    } else {
      var p = byId[id];
      if (!p) return { error: where + ": unknown product id \"" + id.slice(0, 80) + "\". See " + ORIGIN + "/api/products." };
      if (p.isRegular) return { error: where + ": \"" + id + "\" is a reference roll, not a pack you can buy." };
      pack.custom = { sheets: String(p.sheets), width: String(p.width), length: String(p.length), ply: String(p.ply) };
    }
    var rolls = parts[1].trim();
    if (!/^\d{1,4}$/.test(rolls) || Number(rolls) < 1 || Number(rolls) > 1000) return { error: where + ": rolls must be a whole number from 1 to 1000." };
    pack.rolls = String(Number(rolls));
    var price = (parts[2] || "").trim();
    if (price === "") {
      if (needPrice) return { error: where + ": price is missing. Use something like " + id + "," + rolls + ",9.99." };
    } else {
      var n = num(price);
      if (!(n > 0 && n <= 100000)) return { error: where + ": price must be a number above 0, like 9.99." };
      pack.price = String(round(n, 2));
    }
    return { pack: pack };
  }

  function defaultDeal() {
    return {
      mode: DEFAULT_MODE,
      priority: DEFAULT_PRIORITY,
      example: true,
      packs: D.exampleRows.map(function (r) { return newPack(r.productId, r.rolls, r.price.toFixed(2)); }),
    };
  }

  function newPack(productId, rolls, price) {
    var p = byId[productId] || buyable()[0];
    return {
      productId: p.id,
      rolls: String(rolls != null ? rolls : p.defaultRolls),
      price: price != null ? String(price) : "",
      custom: { sheets: String(p.sheets), width: String(p.width), length: String(p.length), ply: String(p.ply) },
    };
  }

  function buyable() { return PRODUCTS.filter(function (p) { return !p.isRegular; }); }

  // params needs get(name), like URLSearchParams. strict: for the API (price required, errors fatal).
  function parseDeal(params, strict) {
    var problems = [];
    var mode = parseMode(params.get("mode"), problems);
    var priority = parsePriority(params.get("p"), problems);
    var packs = [];
    var any = false;
    for (var i = 0; i < PARAMS.length; i++) {
      var raw = params.get(PARAMS[i]);
      if (raw == null) continue;
      any = true;
      var res = parsePack(raw, PARAMS[i], strict);
      if (res.error) problems.push({ param: PARAMS[i], message: res.error });
      else packs.push(res.pack);
    }
    if (!any || packs.length === 0) {
      var d = defaultDeal();
      d.mode = mode;
      d.priority = priority;
      return { state: d, problems: problems, linked: false };
    }
    return { state: { mode: mode, priority: priority, example: false, packs: packs }, problems: problems, linked: true };
  }

  function packParam(pack) {
    var id = pack.productId;
    if (id === "custom") {
      var c = pack.custom;
      id = "custom:" + c.sheets + ":" + c.width + "x" + c.length + ":" + c.ply;
    }
    return id + "," + pack.rolls + "," + pack.price;
  }

  // Query string for a state, or "" for the untouched example.
  function dealQuery(state) {
    var priority = PRIORITIES[state.priority] ? state.priority : DEFAULT_PRIORITY;
    if (state.example && state.mode === DEFAULT_MODE && priority === DEFAULT_PRIORITY) return "";
    var parts = ["mode=" + state.mode];
    if (priority !== DEFAULT_PRIORITY) parts.push("p=" + priority);
    if (!state.example) {
      state.packs.forEach(function (pack, i) {
        if (i >= MAX_PACKS || !packIsLinkable(pack)) return;
        parts.push(PARAMS[i] + "=" + encodeURIComponent(packParam(pack)).replace(/%2C/g, ",").replace(/%3A/g, ":"));
      });
    }
    return parts.join("&");
  }

  // Only packs that would parse back the same way go into a link.
  function packIsLinkable(pack) {
    return parsePack(packParam(pack), "a", false).pack != null;
  }

  function dealLink(state) {
    var q = dealQuery(state);
    return ORIGIN + "/" + (q ? "?" + q : "");
  }

  function parseConverter(params) {
    var problems = [];
    var mode = parseMode(params.get("mode"), problems);
    var roll = params.get("roll");
    var state = { mode: mode, roll: "charmin-ultra-soft-mega-xl" };
    if (roll != null) {
      if (byId[roll]) state.roll = roll;
      else problems.push({ param: "roll", message: "unknown product id \"" + String(roll).slice(0, 80) + "\"." });
    }
    return { state: state, problems: problems, linked: roll != null || params.get("mode") != null };
  }

  function converterQuery(state) {
    var parts = [];
    if (state.roll !== "charmin-ultra-soft-mega-xl") parts.push("roll=" + state.roll);
    if (state.mode !== DEFAULT_MODE) parts.push("mode=" + state.mode);
    return parts.join("&");
  }

  // ======================================================
  // Deal math
  // ======================================================
  function packSpec(pack) {
    if (pack.productId !== "custom") return byId[pack.productId] || null;
    var c = pack.custom;
    var spec = { sheets: num(c.sheets), width: num(c.width), length: num(c.length), ply: num(c.ply) };
    var ok = ["sheets", "width", "length", "ply"].every(function (k) { return spec[k] > 0; });
    return ok ? spec : null;
  }

  function packLabel(pack) {
    return pack.productId === "custom" ? "Custom roll" : shortName(byId[pack.productId]);
  }

  function computePack(pack) {
    var r = { pack: pack, spec: packSpec(pack), soft: softnessOf(pack.productId), rolls: num(pack.rolls), price: num(pack.price), problem: null };
    if (!r.spec) r.problem = "Fill in all four custom numbers (each above 0).";
    else if (!(r.rolls > 0)) r.problem = "Enter how many rolls are in the pack.";
    if (!r.problem) {
      r.totalSheets = r.spec.sheets * r.rolls;
      r.area = sqFtOf(r.spec) * r.rolls;
      r.plyArea = r.area * r.spec.ply;
      if (String(pack.price).trim() !== "" && !(r.price > 0)) r.problem = "That price doesn't look right. Try something like 9.99.";
    }
    r.priced = !r.problem && r.price > 0;
    if (r.priced) r.cost = { sheets: r.price / r.totalSheets, area: r.price / r.area, areaply: r.price / r.plyArea };
    return r;
  }

  // Packs within half a percent of the cheapest all count as best.
  function rank(results, mode) {
    var priced = results.filter(function (r) { return r.priced; });
    if (priced.length < 2) return null;
    var vals = priced.map(function (r) { return r.cost[mode]; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    return {
      min: min,
      max: max,
      winners: priced.filter(function (r) { return r.cost[mode] <= min * 1.005; }),
      worst: priced.filter(function (r) { return r.cost[mode] === max; })[0],
      count: priced.length,
    };
  }

  // Of these packs, the softest, and of those the cheapest (within half a percent).
  function softestOf(pool, mode) {
    var top = Math.max.apply(null, pool.map(function (r) { return r.soft.score; }));
    var softest = pool.filter(function (r) { return r.soft.score === top; });
    var min = Math.min.apply(null, softest.map(function (r) { return r.cost[mode]; }));
    return softest.filter(function (r) { return r.cost[mode] <= min * 1.005; });
  }

  // The winner for a priority. reason says why, for the explanation:
  //   cheap            the cheapest (priority is cheap)
  //   none-rated       no priced pack is rated, so the cheapest
  //   cheapest-unrated Balanced, but the cheapest isn't rated, so it can't be weighed: the cheapest
  //   balanced-cheap   Balanced, nothing softer is cheap enough: the cheapest
  //   balanced-soft    Balanced, a softer pack is within budget
  //   soft             the softest rated pack
  // unrated lists priced packs left out because they aren't rated.
  function pick(results, ranking, mode, priority) {
    if (!ranking) return null;
    var cheapest = ranking.winners;
    var priced = results.filter(function (r) { return r.priced; });
    var rated = priced.filter(function (r) { return r.soft; });
    var unrated = priced.filter(function (r) { return !r.soft; });
    if (priority === "cheap") return { winners: cheapest, reason: "cheap", unrated: [] };
    if (!rated.length) return { winners: cheapest, reason: "none-rated", unrated: unrated };
    if (priority === "soft") return { winners: softestOf(rated, mode), reason: "soft", unrated: unrated };
    var base = cheapest.filter(function (r) { return r.soft; });
    if (!base.length) return { winners: cheapest, reason: "cheapest-unrated", unrated: unrated };
    var baseScore = Math.max.apply(null, base.map(function (r) { return r.soft.score; }));
    var worth = rated.filter(function (r) {
      return r.soft.score > baseScore && r.cost[mode] <= ranking.min * (1 + BALANCE_STEP * (r.soft.score - baseScore)) * 1.000001;
    });
    if (!worth.length) return { winners: cheapest, reason: "balanced-cheap", unrated: unrated, baseScore: baseScore };
    return { winners: softestOf(worth, mode), reason: "balanced-soft", unrated: unrated, baseScore: baseScore };
  }

  function computeDeal(state) {
    var results = state.packs.map(computePack);
    var ranking = rank(results, state.mode);
    return { results: results, ranking: ranking, pick: pick(results, ranking, state.mode, state.priority || DEFAULT_PRIORITY) };
  }

  // Price per unit on each row: cents per 100 sheets, or dollars per 10 sq ft.
  function scoreText(r, mode) {
    if (mode === "sheets") return { value: fix(r.cost.sheets * 10000, 1) + "¢", unit: "per 100 sheets" };
    return { value: money(r.cost[mode] * 10), unit: mode === "areaply" ? "per 10 sq ft × ply" : "per 10 sq ft" };
  }

  // Everything a pack row shows, for the server-rendered HTML and for live updates in the browser.
  var WIN_LABEL = { cheap: "Best deal", balanced: "Best balance", soft: "Softest" };
  function packStatus(r, deal, state) {
    var ranking = deal.ranking;
    var mode = state.mode;
    var winners = deal.pick ? deal.pick.winners : [];
    var s = { value: "", unit: "", vs: "", vsClass: "", winner: winners.indexOf(r) >= 0, meta: "", warning: r.problem || "" };
    if (r.priced) {
      var t = scoreText(r, mode);
      s.value = t.value;
      s.unit = t.unit;
      if (s.winner) { s.vs = winners.length > 1 ? "Tied best" : WIN_LABEL[deal.pick.reason === "none-rated" ? "cheap" : state.priority || DEFAULT_PRIORITY]; s.vsClass = "win"; }
      else if (ranking && r.cost[mode] <= ranking.min * 1.005) { s.vs = "Cheapest"; }
      else if (ranking) { s.vs = "+" + pct(r.cost[mode] / ranking.min - 1) + " more"; s.vsClass = "lose"; }
    } else if (!r.problem) {
      s.unit = "Add a price";
    }
    if (r.totalSheets != null) s.meta = fix(r.totalSheets, 0) + " sheets, " + fix(r.area, 1) + " sq ft, " + r.spec.ply + "-ply · softness " + softText(r.soft);
    return s;
  }

  // ======================================================
  // Deal HTML
  // ======================================================
  function productOptions(selectedId, includeRegulars, includeCustom) {
    var html = "";
    BRAND_KEYS.forEach(function (b) {
      html += '<optgroup label="' + esc(D.brands[b].name) + '">';
      PRODUCTS.forEach(function (p) {
        if (p.brand !== b || (p.isRegular && !includeRegulars)) return;
        html += '<option value="' + p.id + '"' + (p.id === selectedId ? " selected" : "") + ">" + esc(shortName(p)) + "</option>";
      });
      html += "</optgroup>";
    });
    if (includeCustom) {
      html += '<optgroup label="Not listed?"><option value="custom"' + (selectedId === "custom" ? " selected" : "") + ">Custom (type in your own)</option></optgroup>";
    }
    return html;
  }

  function field(label, inner, cls) {
    return '<label class="field ' + cls + '"><span class="field-label">' + label + "</span>" + inner + "</label>";
  }

  function packRowHTML(pack, index, r, status) {
    var letter = LETTERS[index];
    var c = pack.custom;
    var badPrice = String(pack.price).trim() !== "" && !(r.price > 0);
    return '<article class="pack' + (status.winner ? " is-winner" : "") + '" aria-label="Pack ' + letter + '">' +
      '<div class="pack-main">' +
      '<span class="pack-letter" aria-hidden="true">' + letter + "</span>" +
      field("Roll", '<select data-k="productId" autocomplete="off" aria-label="Pack ' + letter + ' roll">' + productOptions(pack.productId, false, true) + "</select>", "product-field") +
      field("Rolls", '<span class="rolls-wrap"><input type="number" data-k="rolls" min="1" step="1" inputmode="numeric" autocomplete="off" value="' + esc(pack.rolls) + '" aria-invalid="' + !(r.rolls > 0) + '"></span>', "rolls-field") +
      field("Price", '<span class="price-wrap"><input type="text" data-k="price" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(pack.price) + '" aria-invalid="' + badPrice + '"></span>', "price-field") +
      '<div class="pack-score"><span class="score-value">' + esc(status.value) + '</span><span class="score-unit">' + esc(status.unit) + "</span>" +
      '<span class="score-vs' + (status.vsClass ? " " + status.vsClass : "") + '">' + esc(status.vs) + "</span></div>" +
      '<button type="button" class="pack-remove" aria-label="Remove pack ' + letter + '" title="Remove">✕</button>' +
      "</div>" +
      '<div class="pack-custom"' + (pack.productId === "custom" ? "" : " hidden") + ">" +
      '<p class="hint">Copy these from the pack.</p>' +
      field("Sheets per roll", '<input type="number" data-c="sheets" min="1" step="1" inputmode="numeric" autocomplete="off" value="' + esc(c.sheets) + '">', "") +
      field("Sheet width (in)", '<input type="number" data-c="width" min="0.1" step="0.01" inputmode="decimal" autocomplete="off" value="' + esc(c.width) + '">', "") +
      field("Sheet length (in)", '<input type="number" data-c="length" min="0.1" step="0.01" inputmode="decimal" autocomplete="off" value="' + esc(c.length) + '">', "") +
      field("Ply", '<input type="number" data-c="ply" min="1" step="1" inputmode="numeric" autocomplete="off" value="' + esc(c.ply) + '">', "") +
      "</div>" +
      '<p class="pack-meta">' + esc(status.meta) + "</p>" +
      '<p class="pack-warning"' + (status.warning ? "" : " hidden") + ">" + esc(status.warning) + "</p>" +
      "</article>";
  }

  var QUIPS = [
    "This one's on a roll.",
    "Wipe out the competition.",
    "Sheer genius.",
    "Tear along the dotted line and take it home.",
  ];

  function letterOf(state, r) { return "Pack " + LETTERS[state.packs.indexOf(r.pack)]; }

  // The result card. Returns { cls, html }.
  function resultHTML(state, deal) {
    var ranking = deal.ranking;
    var mode = state.mode;
    var priority = state.priority || DEFAULT_PRIORITY;
    if (!ranking) {
      var priced = deal.results.filter(function (r) { return r.priced; }).length;
      return {
        cls: "result waiting",
        html: '<p class="result-kicker">Result</p><p>' +
          (priced === 1 ? "Add a price for one more pack to see which is cheaper." : "Enter prices for at least two packs to see which is cheaper.") + "</p>",
      };
    }
    if (priority !== "cheap") return pickHTML(state, deal);
    var w = ranking.winners;
    var cheaper = 1 - ranking.min / ranking.max;
    var worstName = ranking.count > 2 ? "the priciest, " + letterOf(state, ranking.worst) : letterOf(state, ranking.worst);
    var html = '<p class="result-kicker">Best deal by ' + MODES[mode].name + "</p>";
    if (w.length > 1) {
      html += '<p class="result-title">It\'s a tie</p>' +
        '<p class="result-name">' + w.map(function (r) { return letterOf(state, r); }).join(" and ") + " are within half a percent of each other.</p>";
      if (ranking.count > w.length) {
        html += '<p class="result-margin"><strong>' + pct(cheaper) + " cheaper</strong> " + MODES[mode].per + " than " + worstName + ".</p>";
      }
    } else {
      var r = w[0];
      var seed = (r.pack.productId + mode).split("").reduce(function (a, ch) { return a + ch.charCodeAt(0); }, 0);
      html += '<p class="result-title"><span aria-hidden="true">👑 </span>' + letterOf(state, r) + "</p>" +
        '<p class="result-name">' + esc(packLabel(r.pack)) + ", " + fix(r.rolls, 0) + " rolls, " + money(r.price) + "</p>" +
        '<p class="result-margin"><strong>' + pct(cheaper) + " cheaper</strong> " + MODES[mode].per + " than " + worstName + ".</p>";
      var altMode = mode === "area" ? "sheets" : "area";
      var alt = rank(deal.results, altMode);
      if (alt && alt.winners.length === 1) {
        html += '<p class="result-alt">By ' + MODES[altMode].name + ": " +
          (alt.winners[0] === r ? letterOf(state, r) + " also wins." : letterOf(state, alt.winners[0]) + " wins instead.") + "</p>";
      }
      html += '<p class="result-quip">' + esc(QUIPS[seed % QUIPS.length]) + "</p>";
    }
    return { cls: "result has-winner", html: html };
  }

  function softerWords(points) { return points >= 3 ? "a lot softer" : points === 2 ? "softer" : "a little softer"; }
  function lettersOf(state, list) { return list.map(function (r) { return letterOf(state, r); }).join(" and "); }

  // Why the Balanced or Softest pick won, in plain words. Returns { html, text }.
  function explain(state, deal) {
    var p = deal.pick;
    var ranking = deal.ranking;
    var mode = state.mode;
    var per = MODES[mode].per;
    var max = SOFT.max;
    var html = "";
    var text = "";
    var t = function (str) { html += esc(str); text += str; };
    var b = function (str) { html += "<strong>" + esc(str) + "</strong>"; text += str; };
    var w = p.winners[0];
    var tie = p.winners.length > 1;
    var cheap = ranking.winners[0];
    var more = function (r) { return pct(r.cost[mode] / ranking.min - 1); };
    if (p.reason === "none-rated") {
      t("None of these packs is rated for softness, so this is simply the cheapest " + per + ".");
    } else if (p.reason === "cheapest-unrated") {
      b("Cheapest " + per);
      t(". " + (tie ? "They aren't" : "It isn't") + " rated for softness, so Balanced can't weigh " + (tie ? "them" : "it") + " against softer packs.");
    } else if (p.reason === "balanced-cheap") {
      b(tie ? "Tied for cheapest " + per : "Cheapest " + per);
      var softer = deal.results.filter(function (r) { return r.priced && r.soft && r.soft.score > p.baseScore; });
      if (!softer.length) {
        t(", and nothing here is softer.");
      } else {
        var near = softer.slice().sort(function (x, y) { return x.cost[mode] - y.cost[mode]; })[0];
        var gain = near.soft.score - p.baseScore;
        t(". " + letterOf(state, near) + " is " + softerWords(gain) + " (" + near.soft.score + " vs " + p.baseScore + " out of " + max + ") but costs " +
          more(near) + " more " + per + ", and Balanced pays at most " + pct(BALANCE_STEP * gain) + " more for that.");
      }
    } else if (p.reason === "balanced-soft") {
      var points = w.soft.score - p.baseScore;
      t((tie ? "They cost " : "It costs "));
      b(more(w) + " more");
      t(" " + per + " than " + letterOf(state, cheap) + " but " + (tie ? "are " : "is ") + softerWords(points) + " (" + w.soft.score + " vs " + p.baseScore +
        " out of " + max + "). Balanced pays up to " + pct(BALANCE_STEP * points) + " more for that.");
    } else {
      b(tie ? "Equally soft" : "Softest here");
      t(" (" + w.soft.score + " out of " + max + ")");
      if (tie) t(" and within half a percent on price " + per + ".");
      else if (ranking.winners.indexOf(w) >= 0) t(" and also the cheapest " + per + ".");
      else t(". It costs " + more(w) + " more " + per + " than " + letterOf(state, cheap) + ", which " + (cheap.soft ? "is rated " + softText(cheap.soft) + "." : "isn't rated for softness."));
    }
    return { html: html, text: text };
  }

  function pickHTML(state, deal) {
    var p = deal.pick;
    var w = p.winners;
    var fallback = p.reason === "none-rated";
    var html = '<p class="result-kicker">' + (fallback ? "Best deal by " + MODES[state.mode].name : state.priority === "soft" ? "Softest pick" : "Best balance of price and softness") + "</p>";
    if (w.length > 1) {
      html += '<p class="result-title">It\'s a tie</p><p class="result-name">' + lettersOf(state, w) + "</p>";
    } else {
      html += '<p class="result-title"><span aria-hidden="true">👑 </span>' + letterOf(state, w[0]) + "</p>" +
        '<p class="result-name">' + esc(packLabel(w[0].pack)) + ", " + fix(w[0].rolls, 0) + " rolls, " + money(w[0].price) + "</p>";
    }
    html += '<p class="result-margin">' + explain(state, deal).html + "</p>";
    var left = p.reason === "none-rated" || p.reason === "cheapest-unrated" ? [] : p.unrated;
    if (left.length) {
      html += '<p class="result-alt">' + lettersOf(state, left) + (left.length > 1 ? " aren't" : " isn't") + " rated for softness, so " + (left.length > 1 ? "they're" : "it's") + " left out.</p>";
    }
    html += '<p class="result-alt"><a href="/softness">How softness is rated</a></p>';
    return { cls: "result has-winner", html: html };
  }

  // One plain sentence about the result, for link previews and the API.
  function resultSentence(state, deal) {
    var ranking = deal.ranking;
    if (!ranking) return null;
    var describe = function (r) {
      return letterOf(state, r) + " (" + (r.pack.productId === "custom" ? "custom roll" : fullName(byId[r.pack.productId])) + ", " +
        fix(r.rolls, 0) + " rolls, " + money(r.price) + ")";
    };
    var p = deal.pick;
    if (p && p.reason !== "cheap") {
      var what = p.reason === "none-rated" ? " is the cheapest" : state.priority === "soft" ? " is the softest pick" : " is the balanced pick";
      var lead = p.winners.length > 1 ? p.winners.map(describe).join(" and ") + " tie" : describe(p.winners[0]) + what;
      return lead + ". " + explain(state, deal).text;
    }
    var cheaper = pct(1 - ranking.min / ranking.max);
    if (ranking.winners.length > 1) {
      return ranking.winners.map(describe).join(" and ") + " tie on price " + MODES[state.mode].per + "." +
        (ranking.count > ranking.winners.length ? " Both are " + cheaper + " cheaper than " + describe(ranking.worst) + "." : "");
    }
    return describe(ranking.winners[0]) + " is the better deal: " + cheaper + " cheaper " + MODES[state.mode].per + " than " + describe(ranking.worst) + ".";
  }

  function radioGroup(name, keys, defs, selected, labelId, label) {
    return '<div class="segmented" role="radiogroup" aria-labelledby="' + labelId + '">' +
      '<span class="seg-label" id="' + labelId + '">' + label + "</span>" +
      keys.map(function (k) {
        return '<label><input type="radio" name="' + name + '" value="' + k + '" autocomplete="off"' + (k === selected ? " checked" : "") + "><span>" + defs[k].label + "</span></label>";
      }).join("") + "</div>";
  }
  function modeRadios(name, mode, labelId) { return radioGroup(name, MODE_KEYS, MODES, mode, labelId, "Compare by"); }

  function packsHTML(state, deal) {
    return state.packs.map(function (pack, i) {
      var r = deal.results[i];
      return packRowHTML(pack, i, r, packStatus(r, deal, state));
    }).join("");
  }

  // The whole calculator, as served before any JavaScript runs.
  function dealHTML(state) {
    var deal = computeDeal(state);
    var result = resultHTML(state, deal);
    return '<div class="deal-layout">' +
      '<section class="deal-inputs" aria-label="Packs to compare">' +
      '<div class="toolbar">' + modeRadios("judge", state.mode, "judge-label") +
      '<p class="hint" id="judge-help">' + esc(MODES[state.mode].help) + "</p></div>" +
      '<div class="toolbar toolbar-priority">' + radioGroup("priority", PRIORITY_KEYS, PRIORITIES, state.priority || DEFAULT_PRIORITY, "priority-label", "What matters more?") +
      '<p class="hint" id="priority-help">' + esc(priorityHelp(state.priority || DEFAULT_PRIORITY, state.mode)) + "</p></div>" +
      '<p class="hint example-note" id="example-note"' + (state.example ? "" : " hidden") + ">Example prices filled in (made up). Type in what you see.</p>" +
      '<div class="packs" id="packs">' + packsHTML(state, deal) + "</div>" +
      '<div class="pack-actions">' +
      '<button type="button" class="btn btn-primary" id="add-pack"' + (state.packs.length >= MAX_PACKS ? " disabled" : "") + ">+ Add a pack</button>" +
      '<button type="button" class="btn-link" id="reset-packs">Reset</button>' +
      '<button type="button" class="btn-link" id="copy-link" hidden>Copy link</button>' +
      '<span class="copy-status" id="copy-status" role="status"></span>' +
      "</div></section>" +
      '<aside class="' + result.cls + '" id="deal-result" aria-live="polite" aria-atomic="true" aria-label="Result">' + result.html + "</aside>" +
      "</div>";
  }

  // ======================================================
  // Roll converter HTML
  // ======================================================
  function converterCardHTML(state) {
    var p = byId[state.roll];
    var mode = state.mode;
    var stats = [
      ["Sheets per roll", p.sheets + (p.flags.sheets ? tag(p.flags.sheets) : ""), mode === "sheets"],
      ["Sheet size", sizeText(p) + (p.flags.size ? tag(p.flags.size) : "")],
      ["Ply", p.ply + "-ply"],
      mode === "areaply" ? ["Sq ft × ply", fix(plyFtOf(p), 2), true] : ["Sq ft per roll", fix(sqFtOf(p), 2), mode === "area"],
      ["Pack says", p.isRegular ? "= 1 (yardstick)" : p.claim == null ? "no regular-roll claim" : "= " + p.claim + " regular"],
      ["Honest Rolls", fix(honestOf(p), 2)],
    ];
    return '<p class="brand-name-small">' + esc(brandName(p)) + "</p>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<dl class="stats">' + stats.map(function (s) {
        return '<div class="stat' + (s[2] ? " highlight" : "") + '"><dt>' + s[0] + "</dt><dd>" + s[1] + "</dd></div>";
      }).join("") + "</dl>" +
      '<p class="note">' + esc(p.note) + "</p>" +
      '<p class="source">Source: ' + sourceLinks(p) + "</p>";
  }

  function sourceLinks(p) {
    if (!p.sources || !p.sources.length) return esc(p.source);
    return p.sources.map(function (s) {
      return s.url ? '<a href="' + esc(s.url) + '" rel="nofollow noopener">' + esc(s.name) + "</a>" : esc(s.name);
    }).join(", ");
  }

  function metricOf(p, mode) { return MODES[mode].perRoll(p); }

  function converterEqualsHTML(state) {
    var p = byId[state.roll];
    var m = metricOf(p, state.mode);
    return CLAIM_BRANDS.map(function (b) {
      return '<div class="eq-tile ' + b + '"><span class="eq-num">' + fix(m / metricOf(regularOf(b), state.mode), 2) +
        '</span><span class="eq-label">' + esc(D.brands[b].name) + " regular rolls</span></div>";
    }).join("");
  }

  function claimCheckHTML(state) {
    var p = byId[state.roll];
    if (p.isRegular) {
      return "This is " + esc(brandName(p)) + "'s yardstick. Every \"= N regular\" on a " + esc(brandName(p)) + " pack counts these.";
    }
    var m = metricOf(p, state.mode);
    var inRegulars = CLAIM_BRANDS.map(function (b) { return fix(m / metricOf(regularOf(b), state.mode), 2) + " " + esc(D.brands[b].name); }).join(", ").replace(/, ([^,]*)$/, " or $1");
    if (p.claim == null) {
      return esc(brandName(p)) + " doesn't print an \"= N regular\" claim, so its own roll is the unit. By " + MODES[state.mode].name +
        " one roll is " + inRegulars + " regular rolls.";
    }
    var own = m / metricOf(regularOf(p.brand), state.mode);
    var verdict;
    if (Math.abs(own / p.claim - 1) < 0.03) verdict = "That matches its own brand's regular roll.";
    else if (own > p.claim) verdict = "That's more than the pack claims.";
    else verdict = "That's less than the pack claims.";
    return 'The pack says <strong>"= ' + p.claim + ' regular"</strong>. By ' + MODES[state.mode].name + " it's " +
      inRegulars + " regular rolls. " + verdict;
  }

  function chartRowsHTML(state) {
    var mode = MODES[state.mode];
    var sorted = PRODUCTS.slice().sort(function (a, b) { return metricOf(b, state.mode) - metricOf(a, state.mode); });
    var max = metricOf(sorted[0], state.mode);
    var decimals = state.mode === "sheets" ? 0 : 1;
    var cur = metricOf(byId[state.roll], state.mode);
    return sorted.map(function (p) {
      var v = metricOf(p, state.mode);
      // The accessible name is the visible text plus hidden units, so voice control can match it.
      return '<button type="button" class="bar-row ' + p.brand + (p.isRegular ? " regular" : "") + '" data-id="' + p.id + '" aria-pressed="' + (p.id === state.roll) + '">' +
        '<span class="bar-label"><b>' + esc(D.brands[p.brand].short) + "</b> " + esc(p.name) + '<span class="visually-hidden">,</span></span>' +
        '<span class="bar-track"><span class="bar" style="width:' + (v / max * 70).toFixed(2) + '%"></span>' +
        '<span class="bar-value">' + fix(v, decimals) + '<span class="visually-hidden"> ' + esc(mode.unit) + " per roll, equals</span></span></span>" +
        '<span class="bar-ratio">' + (p.id === state.roll ? "1" : fix(cur / v, 2)) + "</span></button>";
    }).join("");
  }

  function converterHTML(state) {
    var p = byId[state.roll];
    return '<div class="conv-layout">' +
      '<section class="conv-left" aria-label="Pick a roll">' +
      '<div class="toolbar"><label class="field"><span class="field-label">Roll</span><select id="conv-select" autocomplete="off">' + productOptions(state.roll, true, false) + "</select></label>" +
      modeRadios("conv-mode", state.mode, "conv-mode-label") + "</div>" +
      '<div class="roll-card ' + p.brand + '" id="conv-card">' + converterCardHTML(state) + "</div>" +
      '<div class="equals-hero" id="conv-regulars" aria-live="polite">' + converterEqualsHTML(state) + "</div>" +
      '<p class="claim-check" id="conv-claim-check">' + claimCheckHTML(state) + "</p>" +
      "</section>" +
      '<section class="conv-right panel" aria-labelledby="chart-title">' +
      '<div class="chart-head"><h2 id="chart-title">One ' + esc(shortName(p)) + " equals</h2>" +
      '<div class="legend" aria-hidden="true">' + BRAND_KEYS.map(function (b) {
        return '<span><i class="swatch ' + b + '"></i>' + esc(D.brands[b].name) + "</span>";
      }).join("") + '<span><i class="swatch regular"></i>Regular</span></div></div>' +
      '<div class="chart-cols" aria-hidden="true"><span>Roll</span><span id="chart-unit">' + MODES[state.mode].column + "</span><span>Equals</span></div>" +
      '<div class="chart" id="chart" role="group" aria-labelledby="chart-title">' + chartRowsHTML(state) + "</div>" +
      '<p class="hint">Tap a row to convert that roll instead.</p>' +
      "</section></div>";
  }

  // ======================================================
  // Server rendering
  // ======================================================
  // Sets the content of the og:description and twitter:description tags in a page. Uses a
  // replacer function, because a string replacement would read "$1" in "$13.49" (or $&, $$,
  // $` and $') as a pattern instead of text.
  var SHARE_DESCRIPTION = /(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*"/g;
  function setShareDescription(page, text) {
    var value = esc(text);
    return page.replace(SHARE_DESCRIPTION, function (match, open) { return open + value + '"'; });
  }

  // ======================================================
  // API payloads
  // ======================================================
  function productJSON(p) {
    var reg = regularOf(p.brand);
    return {
      id: p.id,
      brand: D.brands[p.brand].slug,
      brandName: D.brands[p.brand].name,
      name: p.name,
      fullName: fullName(p),
      line: p.line,
      size: p.size,
      isRegularRoll: !!p.isRegular,
      sheetsPerRoll: p.sheets,
      sheetWidthIn: p.width,
      sheetLengthIn: p.length,
      sqFtPerRoll: round(sqFtOf(p), 2),
      ply: p.ply,
      regularRolls: p.claim == null ? null : p.claim,
      regularRollSheets: reg ? reg.sheets : null,
      honestRolls: round(honestOf(p), 2),
      printedTotal: p.printedTotal ? { sqFt: p.printedTotal.sqft, rolls: p.printedTotal.rolls } : null,
      estimated: { sheets: p.flags.sheets || null, size: p.flags.size || null },
      note: p.note,
      source: p.source,
      sourceUrl: (p.sources || []).filter(function (s) { return s.url; }).map(function (s) { return s.url; })[0] || null,
      sources: (p.sources || []).map(function (s) { return { name: s.name, url: s.url || null }; }),
      softness: softnessJSON(p.id),
      converterUrl: ORIGIN + "/convert?roll=" + p.id,
    };
  }

  // { score, outOf, line, basis, sources } or null when the product isn't rated.
  function softnessJSON(productId) {
    var line = softnessOf(productId);
    if (!line) return null;
    return {
      score: line.score,
      outOf: SOFT.max,
      line: line.name,
      basis: line.why,
      sources: line.sources.map(function (id) {
        var src = SOFT.sources[id];
        return { publisher: src.publisher, title: src.title, url: src.url, date: src.date, dateKind: src.dateKind, method: src.method };
      }),
    };
  }

  function productsJSON() {
    return {
      checked: D.checked,
      units: { sheetWidthIn: "inches", sheetLengthIn: "inches", sqFtPerRoll: "square feet (sheets × width × length / 144)" },
      honestRollSqFt: D.honestRollSqFt,
      softness: { checked: SOFT.checked, outOf: SOFT.max, method: SOFT.method, about: ORIGIN + "/softness" },
      brands: BRAND_KEYS.map(function (b) {
        var br = D.brands[b];
        return { id: br.slug, name: br.name, maker: br.maker, regularRollId: br.regularId || null, regularRollSheets: br.regularId ? byId[br.regularId].sheets : null };
      }),
      products: PRODUCTS.map(productJSON),
    };
  }

  // /api/compare. state must come from parseDeal(params, true) with no problems.
  function compareJSON(state) {
    var deal = computeDeal(state);
    var ranking = deal.ranking;
    var mode = state.mode;
    var winners = deal.pick ? deal.pick.winners : [];
    var cheapest = ranking ? ranking.winners : [];
    return {
      mode: mode,
      modeName: MODES[mode].name,
      priority: state.priority,
      priorityName: PRIORITIES[state.priority].name,
      pickReason: deal.pick ? deal.pick.reason : null,
      packs: deal.results.map(function (r, i) {
        var p = byId[r.pack.productId];
        return {
          pack: PARAMS[i],
          label: "Pack " + LETTERS[i],
          productId: r.pack.productId,
          name: p ? fullName(p) : "Custom roll",
          sheetsPerRoll: r.spec.sheets,
          sheetWidthIn: r.spec.width,
          sheetLengthIn: r.spec.length,
          ply: r.spec.ply,
          rolls: r.rolls,
          price: r.price,
          totalSheets: r.totalSheets,
          totalSqFt: round(r.area, 2),
          pricePer100Sheets: round(r.cost.sheets * 100, 4),
          pricePerSqFt: round(r.cost.area, 4),
          pricePerSqFtPly: round(r.cost.areaply, 4),
          softness: r.soft ? r.soft.score : null,
          best: winners.indexOf(r) >= 0,
          cheapest: cheapest.indexOf(r) >= 0,
          percentMoreThanBest: ranking ? round((r.cost[mode] / ranking.min - 1) * 100, 1) : 0,
        };
      }),
      winner: winners.length === 1 ? PARAMS[state.packs.indexOf(winners[0].pack)] : null,
      tie: winners.length > 1 ? winners.map(function (r) { return PARAMS[state.packs.indexOf(r.pack)]; }) : null,
      percentCheaperThanPriciest: ranking ? round((1 - ranking.min / ranking.max) * 100, 1) : 0,
      summary: resultSentence(state, deal),
      link: dealLink(state),
    };
  }

  // ======================================================
  // Background rolls (the site's sky and the share video)
  // ======================================================
  // A roll seen end-on, spinning, with a ribbon of sheets trailing behind it. Each sheet is
  // nested in the one before and sways a little later, so the wave runs down the ribbon and
  // grows toward the loose end. Only transforms animate.
  var SPOOL =
    '<svg class="spool" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">' +
    '<circle cx="24" cy="24" r="21" fill="#FFFDF8" stroke="#2E2140" stroke-width="2.5"/>' +
    '<path d="M24 9 A15 15 0 0 1 39 24 M24 14 A10 10 0 0 1 34 24" fill="none" stroke="#D9C6AE" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="24" cy="24" r="7" fill="#C99A63" stroke="#2E2140" stroke-width="2.5"/></svg>';

  function skyRollHTML(o) {
    var sheets = "";
    for (var i = o.sheets - 1; i >= 0; i--) {
      sheets = '<div class="sheet" style="animation-delay:' + (-i * 0.22).toFixed(2) + 's">' + sheets + "</div>";
    }
    return '<div class="drifter depth-' + o.depth + '" style="top:' + o.top + ";animation-duration:" + o.duration + "s;animation-delay:" + o.delay + 's">' +
      '<div class="drifter-scale"><div class="drifter-bob" style="animation-delay:' + (o.bobDelay || 0) + 's">' +
      '<div class="ribbon">' + sheets + "</div>" + SPOOL + "</div></div></div>";
  }

  return {
    ORIGIN: ORIGIN, MODES: MODES, MODE_KEYS: MODE_KEYS, DEFAULT_MODE: DEFAULT_MODE,
    PRIORITIES: PRIORITIES, PRIORITY_KEYS: PRIORITY_KEYS, DEFAULT_PRIORITY: DEFAULT_PRIORITY, BALANCE_STEP: BALANCE_STEP, priorityHelp: priorityHelp,
    softnessOf: softnessOf, softText: softText, softnessJSON: softnessJSON, softerWords: softerWords, MAX_PACKS: MAX_PACKS, LETTERS: LETTERS, PARAMS: PARAMS,
    byId: byId, buyable: buyable, regularOf: regularOf,
    sqFtOf: sqFtOf, plyFtOf: plyFtOf, honestOf: honestOf, round: round,
    fix: fix, money: money, pct: pct, esc: esc, tag: tag, brandName: brandName, shortName: shortName, fullName: fullName, sizeText: sizeText,
    num: num, sourceLinks: sourceLinks,
    parseDeal: parseDeal, parsePack: parsePack, defaultDeal: defaultDeal, newPack: newPack, dealQuery: dealQuery, dealLink: dealLink,
    parseConverter: parseConverter, converterQuery: converterQuery,
    computePack: computePack, computeDeal: computeDeal, rank: rank, packStatus: packStatus,
    productOptions: productOptions, packRowHTML: packRowHTML, packsHTML: packsHTML, resultHTML: resultHTML, resultSentence: resultSentence, dealHTML: dealHTML,
    converterHTML: converterHTML, converterCardHTML: converterCardHTML, converterEqualsHTML: converterEqualsHTML, claimCheckHTML: claimCheckHTML, chartRowsHTML: chartRowsHTML,
    productsJSON: productsJSON, productJSON: productJSON, compareJSON: compareJSON,
    skyRollHTML: skyRollHTML, setShareDescription: setShareDescription,
  };
})(TP_DATA);
