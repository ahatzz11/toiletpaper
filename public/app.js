// Toilet Paper Math in the browser. The server already rendered every page from the same
// TPCore functions, so this file only wires up events, keeps the URL in sync, and adds the
// background rolls.
(function () {
  "use strict";

  var Core = window.TPCore;
  var D = window.TP_DATA;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function $(id) { return document.getElementById(id); }

  // Keep the address bar shareable without adding history entries.
  var urlTimer = null;
  function syncURL(query) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var next = location.pathname + (query ? "?" + query : "") + location.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", next);
    }, 400);
  }

  // ======================================================
  // Background: a few rolls unspooling as they drift by
  // ======================================================
  function rand(min, max) { return min + Math.random() * (max - min); }

  function buildSky() {
    var sky = $("sky");
    if (!sky) return;
    if (reduceMotion.matches) { sky.innerHTML = ""; return; }
    if (sky.childElementCount) return;
    // Without styles.css the rolls would sit in the page flow, so skip them.
    if (!getComputedStyle(document.documentElement).getPropertyValue("--bg")) return;
    var layers = window.innerWidth < 640
      ? [{ depth: "far", band: [10, 40], duration: [80, 100], sheets: 6 }, { depth: "near", band: [62, 88], duration: [50, 62], sheets: 8 }]
      : [{ depth: "far", band: [8, 30], duration: [85, 105], sheets: 6 }, { depth: "mid", band: [40, 62], duration: [64, 78], sheets: 7 },
         { depth: "near", band: [70, 88], duration: [48, 58], sheets: 8 }];
    sky.innerHTML = layers.map(function (l) {
      var duration = rand(l.duration[0], l.duration[1]);
      return Core.skyRollHTML({
        depth: l.depth, sheets: l.sheets, top: rand(l.band[0], l.band[1]).toFixed(1) + "%",
        duration: duration.toFixed(1), delay: (-rand(0, duration)).toFixed(1), bobDelay: (-rand(0, 8)).toFixed(1),
      });
    }).join("");
  }

  function setupSky() {
    var sky = $("sky");
    if (!sky) return;
    buildSky();
    // Nothing moves while the tab is hidden.
    document.addEventListener("visibilitychange", function () { sky.classList.toggle("is-paused", document.hidden); });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", buildSky);
  }

  // ======================================================
  // Deal calculator (/)
  // ======================================================
  var deal = null;

  function packEls() { return $("packs").querySelectorAll(".pack"); }

  function renderPacks(focusIndex) {
    var computed = Core.computeDeal(deal);
    $("packs").innerHTML = Core.packsHTML(deal, computed);
    $("add-pack").disabled = deal.packs.length >= Core.MAX_PACKS;
    $("example-note").hidden = !deal.example;
    updateDeals();
    if (focusIndex != null) {
      var el = packEls()[focusIndex];
      if (el) el.querySelector("select").focus();
      else $("add-pack").focus();
    }
  }

  // Update text in place, so typing never loses focus.
  function updateDeals() {
    var computed = Core.computeDeal(deal);
    var els = packEls();
    computed.results.forEach(function (r, i) {
      var el = els[i];
      if (!el) return;
      var s = Core.packStatus(r, computed.ranking, deal.mode);
      el.classList.toggle("is-winner", s.winner);
      el.querySelector(".pack-remove").disabled = deal.packs.length <= 1;
      el.querySelector('[data-k="price"]').setAttribute("aria-invalid", String(String(r.pack.price).trim() !== "" && !(r.price > 0)));
      el.querySelector('[data-k="rolls"]').setAttribute("aria-invalid", String(!(r.rolls > 0)));
      el.querySelector(".score-value").textContent = s.value;
      el.querySelector(".score-unit").textContent = s.unit;
      var vs = el.querySelector(".score-vs");
      vs.className = "score-vs" + (s.vsClass ? " " + s.vsClass : "");
      vs.textContent = s.vs;
      el.querySelector(".pack-meta").textContent = s.meta;
      var warn = el.querySelector(".pack-warning");
      warn.hidden = !s.warning;
      warn.textContent = s.warning;
    });
    var result = Core.resultHTML(deal, computed);
    var box = $("deal-result");
    if (box.innerHTML !== result.html) box.innerHTML = result.html;
    box.className = result.cls;
    $("judge-help").textContent = Core.MODES[deal.mode].help;
    syncURL(Core.dealQuery(deal));
  }

  function onPackInput(e) {
    var el = e.target.closest(".pack");
    if (!el) return;
    var index = Array.prototype.indexOf.call(packEls(), el);
    var pack = deal.packs[index];
    var target = e.target;
    var k = target.dataset.k;
    var ck = target.dataset.c;
    if (k === "productId") {
      var prev = Core.byId[pack.productId];
      var next = target.value;
      if (next === "custom") {
        if (prev) {
          pack.custom = { sheets: String(prev.sheets), width: String(prev.width), length: String(prev.length), ply: String(prev.ply) };
          ["sheets", "width", "length", "ply"].forEach(function (key) { el.querySelector('[data-c="' + key + '"]').value = pack.custom[key]; });
        }
      } else {
        var p = Core.byId[next];
        if (prev && (pack.rolls === String(prev.defaultRolls) || pack.rolls.trim() === "")) {
          // Follow the new roll's usual pack size unless the user typed their own count.
          pack.rolls = String(p.defaultRolls);
          el.querySelector('[data-k="rolls"]').value = pack.rolls;
        }
        pack.custom = { sheets: String(p.sheets), width: String(p.width), length: String(p.length), ply: String(p.ply) };
      }
      pack.productId = next;
      el.querySelector(".pack-custom").hidden = next !== "custom";
    } else if (k) {
      pack[k] = target.value;
    } else if (ck) {
      pack.custom[ck] = target.value;
    } else {
      return;
    }
    if (deal.example) {
      deal.example = false;
      $("example-note").hidden = true;
    }
    updateDeals();
  }

  function setupCopyLink(button, status, link) {
    if (!button || !navigator.clipboard || !window.isSecureContext) return;
    button.hidden = false;
    var timer = null;
    button.addEventListener("click", function () {
      navigator.clipboard.writeText(link()).then(function () {
        status.textContent = "Link copied";
      }, function () {
        status.textContent = "Couldn't copy. The address bar has the same link.";
      });
      clearTimeout(timer);
      timer = setTimeout(function () { status.textContent = ""; }, 2500);
    });
  }

  function setupDeals() {
    var packs = $("packs");
    if (!packs) return;
    deal = Core.parseDeal(new URLSearchParams(location.search), false).state;
    packs.addEventListener("input", onPackInput);
    packs.addEventListener("click", function (e) {
      var btn = e.target.closest(".pack-remove");
      if (!btn) return;
      var index = Array.prototype.indexOf.call(packEls(), btn.closest(".pack"));
      if (index < 0 || deal.packs.length <= 1) return;
      deal.packs.splice(index, 1);
      deal.example = false;
      renderPacks(Math.max(0, index - 1));
    });
    document.querySelectorAll('input[name="judge"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        deal.mode = radio.value;
        updateDeals();
      });
    });
    $("add-pack").addEventListener("click", function () {
      if (deal.packs.length >= Core.MAX_PACKS) return;
      deal.packs.push(Core.newPack(Core.buyable()[0].id));
      deal.example = false;
      renderPacks(deal.packs.length - 1);
    });
    $("reset-packs").addEventListener("click", function () {
      deal = Core.defaultDeal();
      document.querySelector('input[name="judge"][value="' + deal.mode + '"]').checked = true;
      renderPacks();
    });
    setupCopyLink($("copy-link"), $("copy-status"), function () { return Core.dealLink(deal); });
    renderPacks();
  }

  // ======================================================
  // Roll converter (/convert)
  // ======================================================
  var conv = null;

  function renderConverter() {
    var p = Core.byId[conv.roll];
    var focusedBar = document.activeElement && document.activeElement.closest && document.activeElement.closest(".bar-row");
    $("conv-select").value = conv.roll;
    var card = $("conv-card");
    card.className = "roll-card " + p.brand;
    card.innerHTML = Core.converterCardHTML(conv);
    $("conv-regulars").innerHTML = Core.converterEqualsHTML(conv);
    $("conv-claim-check").innerHTML = Core.claimCheckHTML(conv);
    $("chart-title").textContent = "One " + Core.shortName(p) + " equals";
    $("chart-unit").textContent = Core.MODES[conv.mode].column;
    $("chart").innerHTML = Core.chartRowsHTML(conv);
    if (focusedBar) {
      var again = $("chart").querySelector('[data-id="' + focusedBar.dataset.id + '"]');
      if (again) again.focus();
    }
    syncURL(Core.converterQuery(conv));
  }

  function setupConverter() {
    var sel = $("conv-select");
    if (!sel) return;
    conv = Core.parseConverter(new URLSearchParams(location.search)).state;
    sel.addEventListener("change", function () { conv.roll = sel.value; renderConverter(); });
    document.querySelectorAll('input[name="conv-mode"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        conv.mode = radio.value;
        renderConverter();
      });
    });
    $("chart").addEventListener("click", function (e) {
      var row = e.target.closest(".bar-row");
      if (!row) return;
      conv.roll = row.dataset.id;
      renderConverter();
    });
    renderConverter();
  }

  // ---------- go ----------
  if (D && Core) {
    setupSky();
    setupDeals();
    setupConverter();
  }
})();
