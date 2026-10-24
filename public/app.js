(function () {
  "use strict";

  var D = window.TP_DATA;
  var HONEST = D.honestRollSqFt;
  var PRODUCTS = D.products;
  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  var CH_REG = byId["ch-regular"];
  var QN_REG = byId["qn-regular"];
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- math ----------
  function sqFtOf(spec) { return (spec.sheets * spec.width * spec.length) / 144; }
  function plyFtOf(spec) { return sqFtOf(spec) * spec.ply; }
  function honestOf(spec) { return sqFtOf(spec) / HONEST; }

  // The three ways to compare. Sheets is the default everywhere.
  var MODES = {
    sheets: { name: "sheet count", perRoll: function (p) { return p.sheets; }, unit: "sheets", column: "Sheets per roll", per: "per sheet" },
    area: { name: "paper area", perRoll: sqFtOf, unit: "sq ft", column: "Sq ft per roll", per: "per square foot" },
    ply: { name: "area × ply", perRoll: plyFtOf, unit: "sq ft × ply", column: "Sq ft × ply", per: "per square foot of ply" },
  };

  // ---------- formatting ----------
  function fix(n, d) {
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(n) { return "$" + fix(n, 2); }
  function pct(n) { return Math.round(n * 100) + "%"; }
  function brandName(p) { return D.brands[p.brand].name; }
  function shortName(p) { return D.brands[p.brand].short + " " + p.name; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tag(kind) { return ' <span class="tag tag-' + kind + '">' + esc(kind) + "</span>"; }
  function sizeText(spec) { return spec.width + " × " + spec.length + " in"; }
  function $(id) { return document.getElementById(id); }
  function checkedValue(name, fallback) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : fallback;
  }

  // ======================================================
  // Background: a few slow rolls with streamers
  // ======================================================
  var ROLL_SVG =
    '<svg viewBox="0 0 170 80" xmlns="http://www.w3.org/2000/svg">' +
    '<path class="streamer" d="M118 50 C 100 38, 84 66, 60 54 S 24 42, 4 58 L 4 74 C 24 58, 44 70, 60 68 S 100 56, 118 68 Z" fill="#fff" stroke="#2E2140" stroke-opacity=".4" stroke-width="2"/>' +
    '<rect x="112" y="28" width="38" height="46" rx="5" fill="#fff" stroke="#2E2140" stroke-opacity=".6" stroke-width="3"/>' +
    '<ellipse cx="150" cy="51" rx="11" ry="23" fill="#FFFDF8" stroke="#2E2140" stroke-opacity=".6" stroke-width="3"/>' +
    '<ellipse cx="150" cy="51" rx="4.5" ry="9" fill="#C99A63" stroke="#2E2140" stroke-opacity=".6" stroke-width="2"/>' +
    "</svg>";

  function rand(min, max) { return min + Math.random() * (max - min); }

  function buildSky() {
    var sky = $("sky");
    if (!sky || reduceMotion.matches || sky.childElementCount) return;
    var count = window.innerWidth < 640 ? 2 : 3;
    var html = "";
    for (var i = 0; i < count; i++) {
      var dur = rand(50, 80);
      html += '<div class="drifter" style="top:' + rand(15, 85).toFixed(1) + "%;animation-duration:" + dur.toFixed(1) +
        "s;animation-delay:-" + rand(0, dur).toFixed(1) + 's">' + ROLL_SVG + "</div>";
    }
    sky.innerHTML = html;
  }

  function setupPause() {
    var btn = $("pause-toggle");
    if (!btn) return;
    var stored = null;
    try { stored = localStorage.getItem("tp-paused"); } catch (e) { /* storage blocked */ }
    function apply(paused) {
      document.body.classList.toggle("paused", paused);
      btn.setAttribute("aria-pressed", String(paused));
      btn.textContent = paused ? "Let the rolls roll" : "Pause the rolls";
    }
    function sync() {
      if (reduceMotion.matches) {
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
        btn.textContent = "Motion off (system setting)";
      } else {
        btn.disabled = false;
        apply(stored === "1");
        buildSky();
      }
    }
    btn.addEventListener("click", function () {
      var paused = !document.body.classList.contains("paused");
      stored = paused ? "1" : "0";
      try { localStorage.setItem("tp-paused", stored); } catch (e) { /* storage blocked */ }
      apply(paused);
    });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", sync);
    sync();
  }

  function productOptions(includeRegulars) {
    var html = "";
    Object.keys(D.brands).forEach(function (b) {
      html += '<optgroup label="' + esc(D.brands[b].name) + '">';
      PRODUCTS.forEach(function (p) {
        if (p.brand !== b || (p.isRegular && !includeRegulars)) return;
        html += '<option value="' + p.id + '">' + esc(shortName(p)) + "</option>";
      });
      html += "</optgroup>";
    });
    return html;
  }

  // ======================================================
  // Roll converter (/convert)
  // ======================================================
  var conv = { id: "ch-us-megaxl", mode: "sheets" };
  var chartBars = {};

  function convMetric(p) { return MODES[conv.mode].perRoll(p); }

  function renderConverterCard() {
    var p = byId[conv.id];
    var stats = [
      ["Sheets per roll", p.sheets + (p.flags.sheets ? tag(p.flags.sheets) : ""), conv.mode === "sheets"],
      ["Sheet size", sizeText(p) + (p.flags.size ? tag(p.flags.size) : "")],
      ["Ply", p.ply + "-ply"],
      conv.mode === "ply" ? ["Sq ft × ply", fix(plyFtOf(p), 2), true] : ["Sq ft per roll", fix(sqFtOf(p), 2), conv.mode === "area"],
      ["Pack says", p.isRegular ? "= 1 (yardstick)" : "= " + p.claim + " regular"],
      ["Honest Rolls", fix(honestOf(p), 2)],
    ];
    var card = $("conv-card");
    card.className = "roll-card " + p.brand;
    card.innerHTML =
      '<p class="brand-name-small">' + esc(brandName(p)) + "</p>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<dl class="stats">' + stats.map(function (s) {
        return '<div class="stat' + (s[2] ? " highlight" : "") + '"><dt>' + s[0] + "</dt><dd>" + s[1] + "</dd></div>";
      }).join("") + "</dl>" +
      '<p class="note">' + esc(p.note) + "</p>" +
      '<p class="source">Source: ' + esc(p.source) + "</p>";
  }

  function renderConverterEquals() {
    var p = byId[conv.id];
    var m = convMetric(p);
    var inCh = m / convMetric(CH_REG);
    var inQn = m / convMetric(QN_REG);
    $("conv-regulars").innerHTML =
      '<div class="eq-tile charmin"><span class="eq-num">' + fix(inCh, 2) + '</span><span class="eq-label">Charmin regular rolls</span></div>' +
      '<div class="eq-tile qn"><span class="eq-num">' + fix(inQn, 2) + '</span><span class="eq-label">Quilted Northern regular rolls</span></div>';

    var check;
    if (p.isRegular) {
      check = "This is " + esc(brandName(p)) + "'s yardstick. Every \"= N regular\" on a " + esc(brandName(p)) + " pack counts these.";
    } else {
      var own = p.brand === "charmin" ? inCh : inQn;
      var verdict;
      if (Math.abs(own / p.claim - 1) < 0.03) verdict = "That matches its own brand's regular roll.";
      else if (own > p.claim) verdict = "That's more than the pack claims.";
      else verdict = "That's less than the pack claims.";
      check = 'The pack says <strong>"= ' + p.claim + ' regular"</strong>. By ' + MODES[conv.mode].name + " it's " +
        fix(inCh, 2) + " Charmin or " + fix(inQn, 2) + " Quilted Northern regular rolls. " + verdict;
    }
    $("conv-claim-check").innerHTML = check;

    Object.keys(chartBars).forEach(function (id) {
      chartBars[id].querySelector(".bar-ratio").textContent = id === p.id ? "1" : fix(m / convMetric(byId[id]), 2);
    });
    $("chart-title").textContent = "One " + shortName(p) + " equals";
  }

  function buildChart() {
    var chart = $("chart");
    var mode = MODES[conv.mode];
    var sorted = PRODUCTS.slice().sort(function (a, b) { return convMetric(b) - convMetric(a); });
    var max = convMetric(sorted[0]);
    var decimals = conv.mode === "sheets" ? 0 : 1;
    chart.innerHTML = "";
    chartBars = {};
    sorted.forEach(function (p) {
      var v = convMetric(p);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bar-row " + p.brand + (p.isRegular ? " regular" : "");
      btn.setAttribute("aria-pressed", String(p.id === conv.id));
      btn.innerHTML = '<span class="bar-label"><b>' + esc(D.brands[p.brand].short) + "</b> " + esc(p.name) + "</span>" +
        '<span class="bar-track"><span class="bar" style="width:' + (v / max * 70).toFixed(2) + '%"></span>' +
        '<span class="bar-value">' + fix(v, decimals) + "</span></span>" +
        '<span class="bar-ratio"></span>';
      btn.setAttribute("aria-label", shortName(p) + ", " + fix(v, decimals) + " " + mode.unit + " per roll");
      btn.addEventListener("click", function () { selectRoll(p.id); });
      chart.appendChild(btn);
      chartBars[p.id] = btn;
    });
    $("chart-unit").textContent = mode.column;
  }

  function selectRoll(id) {
    conv.id = id;
    $("conv-select").value = id;
    Object.keys(chartBars).forEach(function (k) { chartBars[k].setAttribute("aria-pressed", String(k === id)); });
    renderConverterCard();
    renderConverterEquals();
  }

  function setupConverter() {
    var sel = $("conv-select");
    if (!sel) return;
    conv.mode = checkedValue("conv-mode", "sheets");
    sel.innerHTML = productOptions(true);
    sel.value = conv.id;
    sel.addEventListener("change", function () { selectRoll(sel.value); });
    document.querySelectorAll('input[name="conv-mode"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        conv.mode = radio.value;
        buildChart();
        selectRoll(conv.id);
      });
    });
    buildChart();
    selectRoll(conv.id);
  }

  // ======================================================
  // Deal calculator (/)
  // ======================================================
  var MAX_PACKS = 8;
  var LETTERS = "ABCDEFGH";
  var QUIPS = [
    "This one's on a roll.",
    "Wipe out the competition.",
    "Sheer genius.",
    "Tear along the dotted line and take it home.",
  ];
  var HELP = {
    sheets: "Price per sheet. Simple, though sheet sizes differ a little between brands.",
    area: "Price per square foot of paper. Bigger sheets count for more.",
    ply: "Price per square foot, with a 3-ply sheet counting 1.5 times a 2-ply sheet.",
  };

  var deal = { judge: "sheets", rows: [], showExample: true, uid: 0 };

  function newRow(productId, rolls, price) {
    var p = byId[productId] || PRODUCTS[0];
    deal.uid += 1;
    return {
      uid: deal.uid,
      productId: p.id,
      rolls: String(rolls != null ? rolls : p.defaultRolls),
      price: price != null ? String(price) : "",
      custom: { sheets: String(p.sheets), width: String(p.width), length: String(p.length), ply: String(p.ply) },
    };
  }

  function exampleRows() {
    return D.exampleRows.map(function (r) { return newRow(r.productId, r.rolls, r.price.toFixed(2)); });
  }

  function num(str) {
    if (str == null) return NaN;
    var s = String(str).replace(/[$,\s]/g, "");
    if (s === "") return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function rowSpec(row) {
    if (row.productId !== "custom") return byId[row.productId];
    var c = row.custom;
    var spec = { sheets: num(c.sheets), width: num(c.width), length: num(c.length), ply: num(c.ply) };
    var ok = ["sheets", "width", "length", "ply"].every(function (k) { return spec[k] > 0; });
    return ok ? spec : null;
  }

  function rowLabel(row) {
    return row.productId === "custom" ? "Custom roll" : shortName(byId[row.productId]);
  }

  function computeRow(row) {
    var r = { row: row, spec: rowSpec(row), rolls: num(row.rolls), price: num(row.price), problem: null };
    if (!r.spec) r.problem = "Fill in all four custom numbers (each above 0).";
    else if (!(r.rolls > 0)) r.problem = "Enter how many rolls are in the pack.";
    if (!r.problem) {
      r.totalSheets = r.spec.sheets * r.rolls;
      r.area = sqFtOf(r.spec) * r.rolls;
      r.plyArea = r.area * r.spec.ply;
      if (String(row.price).trim() !== "" && !(r.price > 0)) r.problem = "That price doesn't look right. Try something like 9.99.";
    }
    r.priced = !r.problem && r.price > 0;
    if (r.priced) {
      r.byJudge = { sheets: r.price / r.totalSheets, area: r.price / r.area, ply: r.price / r.plyArea };
    }
    return r;
  }

  // Price per unit shown on each row: cents per 100 sheets, or dollars per 10 sq ft.
  function scoreText(r, judge) {
    if (judge === "sheets") return { value: fix(r.byJudge.sheets * 10000, 1) + "¢", unit: "per 100 sheets" };
    return { value: money(r.byJudge[judge] * 10), unit: judge === "ply" ? "per 10 sq ft × ply" : "per 10 sq ft" };
  }

  function rank(results, judge) {
    var priced = results.filter(function (r) { return r.priced; });
    if (priced.length < 2) return null;
    var vals = priced.map(function (r) { return r.byJudge[judge]; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    return {
      min: min,
      max: max,
      winners: priced.filter(function (r) { return r.byJudge[judge] <= min * 1.005; }),
      worst: priced.filter(function (r) { return r.byJudge[judge] === max; })[0],
      count: priced.length,
    };
  }

  function field(label, inner, cls) {
    return '<label class="field ' + cls + '"><span class="field-label">' + label + "</span>" + inner + "</label>";
  }

  function buildRowEl(row, index) {
    var el = document.createElement("article");
    var letter = LETTERS[index];
    var c = row.custom;
    el.className = "pack";
    el.dataset.uid = row.uid;
    el.setAttribute("aria-label", "Pack " + letter);
    el.innerHTML =
      '<div class="pack-main">' +
      '<span class="pack-letter" aria-hidden="true">' + letter + "</span>" +
      field("Roll", '<select data-k="productId" aria-label="Pack ' + letter + ' roll">' + productOptions(false) +
        '<optgroup label="Not listed?"><option value="custom">Custom (type in your own)</option></optgroup></select>', "product-field") +
      field("Rolls", '<span class="rolls-wrap"><input type="number" data-k="rolls" min="1" step="1" inputmode="numeric" value="' + esc(row.rolls) + '"></span>', "rolls-field") +
      field("Price", '<span class="price-wrap"><input type="text" data-k="price" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(row.price) + '"></span>', "price-field") +
      '<div class="pack-score"><span class="score-value"></span><span class="score-unit"></span><span class="score-vs"></span></div>' +
      '<button type="button" class="pack-remove" aria-label="Remove pack ' + letter + '" title="Remove">✕</button>' +
      "</div>" +
      '<div class="pack-custom"' + (row.productId === "custom" ? "" : " hidden") + ">" +
      '<p class="hint">Copy these from the pack.</p>' +
      field("Sheets per roll", '<input type="number" data-c="sheets" min="1" step="1" inputmode="numeric" value="' + esc(c.sheets) + '">', "") +
      field("Sheet width (in)", '<input type="number" data-c="width" min="0.1" step="0.01" inputmode="decimal" value="' + esc(c.width) + '">', "") +
      field("Sheet length (in)", '<input type="number" data-c="length" min="0.1" step="0.01" inputmode="decimal" value="' + esc(c.length) + '">', "") +
      field("Ply", '<input type="number" data-c="ply" min="1" step="1" inputmode="numeric" value="' + esc(c.ply) + '">', "") +
      "</div>" +
      '<p class="pack-meta"></p>' +
      '<p class="pack-warning" hidden></p>';
    el.querySelector('select[data-k="productId"]').value = row.productId;
    el.addEventListener("input", function (e) { onRowInput(row, el, e.target); });
    el.querySelector(".pack-remove").addEventListener("click", function () { removeRow(row.uid); });
    return el;
  }

  function onRowInput(row, el, target) {
    var k = target.dataset.k;
    var ck = target.dataset.c;
    if (k === "productId") {
      var prev = byId[row.productId];
      var next = target.value;
      if (next === "custom") {
        if (prev) {
          row.custom = { sheets: String(prev.sheets), width: String(prev.width), length: String(prev.length), ply: String(prev.ply) };
          ["sheets", "width", "length", "ply"].forEach(function (key) {
            el.querySelector('[data-c="' + key + '"]').value = row.custom[key];
          });
        }
      } else if (prev && (row.rolls === String(prev.defaultRolls) || row.rolls.trim() === "")) {
        // Follow the new roll's usual pack size unless the user typed their own count.
        row.rolls = String(byId[next].defaultRolls);
        el.querySelector('[data-k="rolls"]').value = row.rolls;
      }
      row.productId = next;
      el.querySelector(".pack-custom").hidden = next !== "custom";
    } else if (k) {
      row[k] = target.value;
      if (k === "price" && deal.showExample) {
        deal.showExample = false;
        $("example-note").hidden = true;
      }
    } else if (ck) {
      row.custom[ck] = target.value;
    } else {
      return;
    }
    updateDeals();
  }

  function renderRows(focusUid) {
    var wrap = $("packs");
    wrap.innerHTML = "";
    deal.rows.forEach(function (row, i) { wrap.appendChild(buildRowEl(row, i)); });
    $("add-pack").disabled = deal.rows.length >= MAX_PACKS;
    $("example-note").hidden = !deal.showExample;
    updateDeals();
    if (focusUid != null) {
      var target = wrap.querySelector('[data-uid="' + focusUid + '"] select');
      if (target) target.focus();
    }
  }

  function removeRow(uid) {
    var idx = deal.rows.findIndex(function (r) { return r.uid === uid; });
    if (idx < 0) return;
    deal.rows.splice(idx, 1);
    renderRows();
    var rows = $("packs").querySelectorAll(".pack");
    var focusEl = rows[Math.max(0, idx - 1)];
    if (focusEl) focusEl.querySelector("select").focus();
    else $("add-pack").focus();
  }

  function updateDeals() {
    var judge = deal.judge;
    var results = deal.rows.map(computeRow);
    var ranking = rank(results, judge);
    var winners = ranking ? ranking.winners : [];
    var els = $("packs").querySelectorAll(".pack");

    results.forEach(function (r, i) {
      var el = els[i];
      if (!el) return;
      var isWinner = winners.indexOf(r) >= 0;
      el.classList.toggle("is-winner", isWinner);
      el.querySelector(".pack-remove").disabled = deal.rows.length <= 1;
      el.querySelector('[data-k="price"]').setAttribute("aria-invalid", String(String(r.row.price).trim() !== "" && !(r.price > 0)));
      el.querySelector('[data-k="rolls"]').setAttribute("aria-invalid", String(!(r.rolls > 0)));

      var value = el.querySelector(".score-value");
      var unit = el.querySelector(".score-unit");
      var vs = el.querySelector(".score-vs");
      vs.className = "score-vs";
      if (r.priced) {
        var s = scoreText(r, judge);
        value.textContent = s.value;
        unit.textContent = s.unit;
        if (isWinner) { vs.textContent = winners.length > 1 ? "Tied best" : "Best deal"; vs.classList.add("win"); }
        else if (ranking) { vs.textContent = "+" + pct(r.byJudge[judge] / ranking.min - 1) + " more"; vs.classList.add("lose"); }
        else vs.textContent = "";
      } else {
        value.textContent = "";
        unit.textContent = r.problem ? "" : "Add a price";
        vs.textContent = "";
      }

      el.querySelector(".pack-meta").textContent = r.totalSheets != null
        ? fix(r.totalSheets, 0) + " sheets, " + fix(r.area, 1) + " sq ft, " + r.spec.ply + "-ply"
        : "";
      var warn = el.querySelector(".pack-warning");
      warn.hidden = !r.problem;
      warn.textContent = r.problem || "";
    });

    renderResult(results, ranking, judge);
  }

  function letterOf(r) { return "Pack " + LETTERS[deal.rows.indexOf(r.row)]; }

  var lastResult = "";

  function renderResult(results, ranking, judge) {
    var box = $("deal-result");
    var cls = "result";
    var html;
    if (!ranking) {
      cls += " waiting";
      var priced = results.filter(function (r) { return r.priced; }).length;
      html = '<p class="result-kicker">Result</p><p>' +
        (priced === 1 ? "Add a price for one more pack to see which is cheaper." : "Enter prices for at least two packs to see which is cheaper.") + "</p>";
    } else {
      cls += " has-winner";
      var w = ranking.winners;
      var cheaper = 1 - ranking.min / ranking.max;
      var worstName = ranking.count > 2 ? "the priciest, " + letterOf(ranking.worst) : letterOf(ranking.worst);
      html = '<p class="result-kicker">Best deal by ' + MODES[judge].name + "</p>";
      if (w.length > 1) {
        html += '<p class="result-title">It\'s a tie</p>' +
          '<p class="result-name">' + w.map(letterOf).join(" and ") + " are within half a percent of each other.</p>";
        if (ranking.count > w.length) {
          html += '<p class="result-margin"><strong>' + pct(cheaper) + " cheaper</strong> " + MODES[judge].per + " than " + worstName + ".</p>";
        }
      } else {
        var r = w[0];
        var seed = (r.row.productId + judge).split("").reduce(function (a, ch) { return a + ch.charCodeAt(0); }, 0);
        html += '<p class="result-title"><span aria-hidden="true">👑 </span>' + letterOf(r) + "</p>" +
          '<p class="result-name">' + esc(rowLabel(r.row)) + ", " + fix(r.rolls, 0) + " rolls, " + money(r.price) + "</p>" +
          '<p class="result-margin"><strong>' + pct(cheaper) + " cheaper</strong> " + MODES[judge].per + " than " + worstName + ".</p>";
        var altMode = judge === "area" ? "sheets" : "area";
        var alt = rank(results, altMode);
        if (alt && alt.winners.length === 1) {
          html += '<p class="result-alt">By ' + MODES[altMode].name + ": " +
            (alt.winners[0] === r ? letterOf(r) + " also wins." : letterOf(alt.winners[0]) + " wins instead.") + "</p>";
        }
        html += '<p class="result-quip">' + esc(QUIPS[seed % QUIPS.length]) + "</p>";
      }
    }
    if (html !== lastResult) {
      box.className = cls;
      box.innerHTML = html;
      lastResult = html;
    }
  }

  function setJudge(value) {
    deal.judge = value;
    $("judge-help").textContent = HELP[value];
  }

  function setupDeals() {
    if (!$("packs")) return;
    deal.rows = exampleRows();
    setJudge(checkedValue("judge", "sheets"));
    document.querySelectorAll('input[name="judge"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        setJudge(radio.value);
        updateDeals();
      });
    });
    $("add-pack").addEventListener("click", function () {
      if (deal.rows.length >= MAX_PACKS) return;
      var row = newRow(PRODUCTS[0].id);
      deal.rows.push(row);
      renderRows(row.uid);
    });
    $("reset-packs").addEventListener("click", function () {
      deal.rows = exampleRows();
      deal.showExample = true;
      document.querySelector('input[name="judge"][value="sheets"]').checked = true;
      setJudge("sheets");
      renderRows();
    });
    renderRows();
  }

  // ======================================================
  // How it works (/about)
  // ======================================================
  function renderRegulars() {
    if (!$("ch-regular-detail")) return;
    $("ch-regular-sheets").textContent = CH_REG.sheets;
    $("qn-regular-sheets").textContent = QN_REG.sheets;
    $("ch-regular-detail").textContent = sizeText(CH_REG) + " sheets, " + CH_REG.ply + "-ply, " + fix(sqFtOf(CH_REG), 2) + " sq ft per roll.";
    $("qn-regular-detail").textContent = sizeText(QN_REG) + " sheets (our guess), " + QN_REG.ply + "-ply, " + fix(sqFtOf(QN_REG), 2) + " sq ft per roll.";
    $("ch-reg-sqft").textContent = fix(sqFtOf(CH_REG), 2);
    $("qn-reg-sqft").textContent = fix(sqFtOf(QN_REG), 2);
    $("checked-date").textContent = D.checked;
  }

  function versus(rows, brand) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.sheets; }));
    return '<div class="versus">' + rows.map(function (r) {
      return '<div class="versus-row"><span>' + esc(r.label) + '</span><span class="versus-bar ' + (r.brand || brand) +
        (r.faded ? " faded" : "") + '" style="width:' + (r.sheets / max * 100).toFixed(1) + '%">' + r.sheets + "</span></div>";
    }).join("") + "</div>";
  }

  function claimStamp(n) { return '<span class="claim-stamp">"= ' + n + ' regular"</span>'; }

  function renderShrink() {
    var grid = $("shrink-grid");
    if (!grid) return;
    var cards = [];
    var chMega = byId["ch-us-mega"];
    var chOld = D.history["ch-us-mega"];
    cards.push({
      stamp: "Shrank",
      title: "Charmin Ultra Soft Mega",
      bars: versus([{ label: chOld.label, sheets: chOld.sheets, faded: true }, { label: "Now", sheets: chMega.sheets }], "charmin"),
      body: "<p>" + (chOld.sheets - chMega.sheets) + " fewer sheets per roll (" + pct(1 - chMega.sheets / chOld.sheets) + " less), still " +
        claimStamp(chMega.claim) + ". If both claims are true, Charmin's regular roll went from " + chOld.sheets / chMega.claim +
        " sheets to " + chMega.sheets / chMega.claim + ".</p>",
    });

    var s6 = byId["qn-uss-supermega6"];
    var s8 = byId["qn-uss-supermega8"];
    cards.push({
      stamp: "Same name",
      title: "QN Ultra Soft & Strong Super Mega",
      bars: versus([{ label: "8 pack", sheets: s8.sheets }, { label: "6 pack", sheets: s6.sheets }], "qn"),
      body: "<p>One name, two rolls: " + s8.sheets + " sheets and " + s6.sheets + " sheets. Both say " + claimStamp(s6.claim) +
        ", so the regular roll is " + s6.sheets / s6.claim + " sheets on one pack and " + s8.sheets / s8.claim + " on the other.</p>",
    });

    var oldSM = byId["ch-ust-supermega"];
    var newXL = byId["ch-ust-megaxl"];
    cards.push({
      stamp: "Renamed",
      title: "Charmin Super Mega is now Mega XL",
      bars: versus([{ label: "Super Mega", sheets: oldSM.sheets, faded: true }, { label: "Mega XL", sheets: newXL.sheets }], "charmin"),
      body: "<p>In Ultra Strong, the older Super Mega pack had " + oldSM.sheets + " sheets and today's Mega XL has " + newXL.sheets +
        ", " + (oldSM.sheets - newXL.sheets) + " fewer (" + pct(1 - newXL.sheets / oldSM.sheets) + "). Both say " + claimStamp(newXL.claim) + ".</p>",
    });

    var qnMega = byId["qn-uss-mega"];
    var qnOld = D.history["qn-uss-mega"];
    cards.push({
      stamp: "Bragging",
      title: "QN: \"255 sheets vs 208\"",
      bars: versus([
        { label: "QN, older", sheets: qnOld.sheets, brand: "qn", faded: true },
        { label: "QN Mega now", sheets: qnMega.sheets, brand: "qn" },
        { label: "Charmin Mega", sheets: chMega.sheets, brand: "charmin" },
      ]),
      body: "<p>Quilted Northern's site compares its " + qnMega.sheets + "-sheet Mega to the \"national leading brand\" Mega at " +
        chMega.sheets + ". By paper area that's " + pct(sqFtOf(qnMega) / sqFtOf(chMega) - 1) + " more. Older QN Ultra Soft & Strong Mega packs had " +
        qnOld.sheets + " sheets.</p>",
    });

    grid.innerHTML = cards.map(function (c) {
      return '<article class="shrink-card"><span class="stamp">' + esc(c.stamp) + "</span><h3>" + esc(c.title) + "</h3>" + c.bars + c.body + "</article>";
    }).join("");
  }

  function renderSources() {
    var body = $("sources-body");
    if (!body) return;
    var html = "";
    Object.keys(D.brands).forEach(function (b) {
      html += '<tr class="group"><td colspan="8">' + esc(D.brands[b].name) + "</td></tr>";
      PRODUCTS.forEach(function (p) {
        if (p.brand !== b) return;
        var sq = sqFtOf(p);
        var printed = p.printedTotal
          ? p.printedTotal.sqft + " sq ft per " + p.printedTotal.rolls + " rolls printed; we get " + fix(sq * p.printedTotal.rolls, 1)
          : "No total recorded";
        html += '<tr class="' + p.brand + '">' +
          '<td class="brand-cell">' + esc(p.name) + "</td>" +
          '<td class="num">' + p.sheets + (p.flags.sheets ? tag(p.flags.sheets) : "") + "</td>" +
          '<td class="num">' + p.width + " × " + p.length + (p.flags.size ? tag(p.flags.size) : "") + "</td>" +
          '<td class="num">' + p.ply + "</td>" +
          '<td class="num">' + (p.isRegular ? "the yardstick" : "= " + p.claim + " regular") + "</td>" +
          '<td class="num">' + fix(sq, 2) + "</td>" +
          "<td>" + printed + "</td>" +
          "<td>" + esc(p.source) + "</td></tr>";
      });
    });
    body.innerHTML = html;
  }

  // ---------- go ----------
  setupPause();
  setupDeals();
  setupConverter();
  renderRegulars();
  renderShrink();
  renderSources();
})();
