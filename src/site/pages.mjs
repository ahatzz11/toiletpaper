// Every HTML page on the site. Numbers in the copy come from data.js through TPCore, so the
// tables, FAQ answers, API and llms.txt can't disagree with each other.

import { ORIGIN } from "./config.mjs";
import { TOOL_END, TOOL_START, esc } from "./layout.mjs";

export function buildSite(D, Core) {
  const { byId, fix, pct, sqFtOf, fullName, shortName, sizeText, tag, sourceLinks } = Core;
  const brandKeys = Object.keys(D.brands);
  const brands = brandKeys.map((k) => ({ key: k, ...D.brands[k], regular: Core.regularOf(k) }));
  // Brands with an "= N regular rolls" yardstick, and the ones without (their own roll is the unit).
  const claimBrands = brands.filter((b) => b.regular);
  const noClaimBrands = brands.filter((b) => !b.regular);
  const brandList = brands.map((b) => b.name).join(", ").replace(/, ([^,]*)$/, " or $1");
  const brandAnd = brands.map((b) => b.name).join(", ").replace(/, ([^,]*)$/, " and $1");
  const listJoin = (items) => items.length < 3 ? items.join(" and ") : items.slice(0, -1).join(", ") + " and " + items.at(-1);
  const noClaimNote = noClaimBrands.length ? ` ${listJoin(noClaimBrands.map((b) => esc(b.name)))} doesn't make that claim at all and just prints the sheet count.` : "";
  const products = D.products;
  const buyable = products.filter((p) => !p.isRegular);
  const ofBrand = (b) => products.filter((p) => p.brand === b);
  const regularRolls = (p) => Core.regularOf(p.brand) ? fix(p.sheets / Core.regularOf(p.brand).sheets, 2) : "n/a";
  const packSays = (p) => p.isRegular ? "the yardstick" : p.claim == null ? "no claim" : `= ${p.claim} regular`;
  const strip = (html) => html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  const convLink = (p) => `/convert?roll=${p.id}`;
  const dealLink = (packs) => "/?" + packs.map((p, i) => `${Core.PARAMS[i]}=${p.id},${p.defaultRolls},`).join("&");

  const siteDescription = `Free calculators that compare ${brandAnd} toilet paper by price per sheet and per square foot, and decode roll names like Mega, Mega XL and Super Mega.`;

  // ---------- shared pieces ----------
  function factsTable(rows, caption) {
    let html = `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(caption)}"><table class="sources facts"><caption class="visually-hidden">${esc(caption)}</caption>` +
      '<thead><tr><th scope="col">Roll</th><th scope="col" class="num">Sheets per roll</th><th scope="col" class="num">Sheet size</th><th scope="col" class="num">Ply</th>' +
      '<th scope="col" class="num">Sq ft per roll</th><th scope="col" class="num">Pack says</th><th scope="col" class="num">Regular rolls by sheet count</th></tr></thead><tbody>';
    let brand = null;
    for (const p of rows) {
      if (p.brand !== brand) {
        brand = p.brand;
        html += `<tr class="group"><td colspan="7">${esc(D.brands[brand].name)}</td></tr>`;
      }
      html += `<tr class="${p.brand}"><th scope="row" class="brand-cell"><a href="${convLink(p)}">${esc(p.name)}</a></th>` +
        `<td class="num">${p.sheets}${p.flags.sheets ? tag(p.flags.sheets) : ""}</td>` +
        `<td class="num">${sizeText(p)}${p.flags.size ? tag(p.flags.size) : ""}</td>` +
        `<td class="num">${p.ply}</td><td class="num">${fix(sqFtOf(p), 1)}</td>` +
        `<td class="num">${packSays(p)}</td>` +
        `<td class="num">${regularRolls(p)}</td></tr>`;
    }
    return html + "</tbody></table></div>";
  }

  function sourcesTable() {
    let html = '<div class="table-scroll" tabindex="0" role="region" aria-label="Sources table"><table class="sources"><caption class="visually-hidden">Roll data and sources</caption>' +
      '<thead><tr><th scope="col">Roll</th><th scope="col">Sheets</th><th scope="col">Sheet size (in)</th><th scope="col">Ply</th><th scope="col">Pack claim</th>' +
      '<th scope="col">Sq ft per roll</th><th scope="col">Printed total vs our math</th><th scope="col">Source</th></tr></thead><tbody>';
    for (const b of brands) {
      html += `<tr class="group"><td colspan="8">${esc(b.name)}</td></tr>`;
      for (const p of ofBrand(b.key)) {
        const sq = sqFtOf(p);
        const printed = p.printedTotal
          ? `${p.printedTotal.sqft} sq ft per ${p.printedTotal.rolls} rolls printed; we get ${fix(sq * p.printedTotal.rolls, 1)}`
          : "No total recorded";
        html += `<tr class="${p.brand}"><td class="brand-cell">${esc(p.name)}</td>` +
          `<td class="num">${p.sheets}${p.flags.sheets ? tag(p.flags.sheets) : ""}</td>` +
          `<td class="num">${p.width} × ${p.length}${p.flags.size ? tag(p.flags.size) : ""}</td>` +
          `<td class="num">${p.ply}</td><td class="num">${packSays(p)}</td>` +
          `<td class="num">${fix(sq, 2)}</td><td>${printed}</td><td>${sourceLinks(p)}</td></tr>`;
      }
    }
    return html + "</tbody></table></div>";
  }

  // ---------- FAQ (visible on /about, and the same text in FAQPage JSON-LD) ----------
  const megas = products.filter((p) => p.size === "Mega");
  const range = (list) => {
    const n = list.map((p) => p.sheets);
    return Math.min(...n) === Math.max(...n) ? String(n[0]) : `${Math.min(...n)} to ${Math.max(...n)}`;
  };
  const plyLines = (ply) => listJoin(buyable.filter((p) => p.ply === ply).map((p) => `${D.brands[p.brand].name} ${p.line}`).filter((v, i, a) => a.indexOf(v) === i));
  const chMegaNow = byId["charmin-ultra-soft-mega"];
  const chMegaOld = D.history["charmin-ultra-soft-mega"];
  const oldSM = byId["charmin-ultra-strong-super-mega-older"];
  const newXL = byId["charmin-ultra-strong-mega-xl"];
  const qnSM = [byId["quilted-northern-ultra-soft-strong-super-mega-378"], byId["quilted-northern-ultra-soft-strong-super-mega-438"]];
  // ---------- softness ----------
  const S = D.softness;
  const softLines = Object.entries(S.lines).map(([key, l]) => ({ key, ...l, products: buyable.filter((p) => p.soft === key) }));
  const ratedLines = softLines.filter((l) => l.score != null).sort((a, b) => a.score - b.score);
  const unratedLines = softLines.filter((l) => l.score == null);
  const softest = ratedLines.filter((l) => l.score === ratedLines.at(-1)?.score);
  // A word for each part of the scale, so the numbers read as something.
  const softBand = (n) => n >= 9 ? "Plush" : n >= 7 ? "Soft" : n >= 5 ? "Fine" : n >= 3 ? "Thin" : "Scratchy";
  // "Super Mega (378 sheets)" when a line has two packs of the same size.
  const sizeLabel = (p) => {
    const twin = buyable.some((o) => o !== p && o.soft === p.soft && o.size === p.size);
    const note = / \(([^)]+)\)$/.exec(p.name);
    return (p.size ?? `${p.sheets}-sheet roll`) + (twin && note ? ` (${note[1]})` : "");
  };
  const sizeLinks = (l) => l.products.map((p) => `<a href="${convLink(p)}">${esc(sizeLabel(p))}</a>`).join("");
  const softSourceLinks = (l) => l.sources.map((id) => {
    const s = S.sources[id];
    return `<a href="${esc(s.url)}">${esc(s.publisher)}</a> <span class="nowrap">(${esc(s.dateKind)} ${esc(s.date)})</span>`;
  }).join("; ");
  const softItem = (l) => `<li class="soft-item ${l.products[0].brand}"><a class="soft-item-name" href="/softness#why-${l.key}">${esc(l.name)}</a>` +
    `<span class="soft-sizes">${sizeLinks(l)}</span></li>`;

  function softScaleHTML() {
    const rough = S.jokes.filter((j) => j.end === "rough");
    const soft = S.jokes.filter((j) => j.end === "soft");
    const joke = (j) => `<li class="soft-sheet soft-joke soft-${j.id}"><p class="soft-level"><span class="soft-joke-tag">Joke</span></p>` +
      `<div class="soft-joke-body"><p class="soft-joke-name">${j.icon ? `<span aria-hidden="true">${j.icon} </span>` : ""}${esc(j.name)}</p><p class="soft-joke-note">${esc(j.note)}</p></div></li>`;
    const levels = [];
    for (let n = 1; n <= S.max; n++) {
      const here = ratedLines.filter((l) => l.score === n);
      levels.push(`<li class="soft-sheet${here.length ? "" : " is-empty"}" id="soft-${n}"><p class="soft-level"><span class="soft-num">${n}</span><span class="soft-of"> out of ${S.max}</span> <span class="soft-band">${softBand(n)}</span></p>` +
        (here.length ? `<ul class="soft-items">${here.map(softItem).join("")}</ul>` : "") + "</li>");
    }
    return `<div class="soft-scale"><ol class="soft-strip" aria-label="Softness scale, least soft first">${[...rough.map(joke), ...levels, ...soft.map(joke)].join("")}</ol></div>`;
  }

  function softTableHTML() {
    const rows = [...ratedLines.slice().reverse(), ...unratedLines].map((l) =>
      `<tr class="${l.products[0].brand}" id="why-${l.key}"><td class="brand-cell">${esc(l.name)}</td>` +
      `<td class="num">${l.score != null ? `${l.score}/${S.max}` : "Not rated"}</td><td>${l.why ? esc(l.why) : ""}</td>` +
      `<td>${l.sources.length ? softSourceLinks(l) : "No usable test yet"}</td></tr>`).join("");
    return '<div class="table-scroll" tabindex="0" role="region" aria-label="Softness scores table"><table class="sources soft-table"><caption class="visually-hidden">Softness score, reasoning and sources for each line</caption>' +
      '<thead><tr><th scope="col">Line</th><th scope="col">Score</th><th scope="col">Why</th><th scope="col">Sources</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }
  const softMethodHTML = `<ul>${S.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`;
  const softSourcesHTML = `<ul class="soft-source-list">${Object.values(S.sources).map((s) =>
    `<li><a href="${esc(s.url)}">${esc(s.publisher)}: ${esc(s.title)}</a>. ${esc(s.method)}. ${esc(s.dateKind[0].toUpperCase() + s.dateKind.slice(1))} ${esc(s.date)}.</li>`).join("")}</ul>`;

  const faq = [
    {
      id: "why-sheets",
      q: "Why compare by sheets?",
      html: `Because the name on the pack doesn't say how much paper is on the roll, and a sheet is a sheet. Count the sheets, divide the price by them, and the lower number wins. When two packs use quite different sheet sizes, compare by paper area instead. <a href="/">The calculator</a> does both.`,
    },
    {
      id: "mega",
      q: "What do Mega and Mega XL mean?",
      html: `They're size names, not sheet counts, and each brand picks its own. ${brands.map((b) => {
        const m = megas.filter((p) => p.brand === b.key);
        const xl = products.filter((p) => p.brand === b.key && p.size === "Mega XL");
        return m.length ? `${b.name} Mega has ${range(m)} sheets${xl.length ? ` and Mega XL has ${range(xl)}` : ""}.` : "";
      }).filter(Boolean).join(" ")}${(() => {
        const plain = brands.filter((b) => !products.some((p) => p.brand === b.key && /Mega/.test(p.size)));
        return plain.length ? ` ${listJoin(plain.map((b) => esc(b.name)))} skips the size names and just prints the sheet count.` : "";
      })()} At Charmin, Mega XL replaced Super Mega. Quilted Northern still calls its bigger roll Super Mega. See <a href="/how-many-sheets-in-a-mega-roll">every Mega size</a>.`,
    },
    {
      id: "regular-rolls",
      q: "Why does \"= 4 regular rolls\" differ by brand?",
      html: `Each brand compares its big rolls to its own regular roll, and the brands don't agree on what a regular roll is. ${claimBrands.map((b) =>
        `${b.name}'s has ${b.regular.sheets} sheets`).join(", ")}. So "= 4 regular rolls" means ${listJoin(claimBrands.map((b) => `${b.regular.sheets * 4} sheets at ${b.name}`))}.${noClaimNote} <a href="/charmin-mega-vs-quilted-northern-mega">Charmin Mega vs Quilted Northern Mega</a> goes through one example.`,
    },
    {
      id: "ply",
      q: "Does ply matter?",
      html: `A bit. Ply is the number of layers in a sheet: more layers make a thicker sheet, not a bigger one. ${plyLines(3)} is 3-ply, ${plyLines(1)} is 1-ply, and the rest here are 2-ply. Pick <strong>Area × ply</strong> in the calculator to count a 3-ply sheet as 1.5 two-ply sheets. Whether that's worth paying for is between you and your bathroom.`,
    },
    {
      id: "sheet-size",
      q: "Are all sheets the same size?",
      html: `Close, but no. Most are about 4 inches square. ${brands.map((b) => {
        const sizes = new Map();
        for (const p of buyable.filter((x) => x.brand === b.key)) {
          const key = sizeText(p);
          if (!sizes.has(key)) sizes.set(key, []);
          sizes.get(key).push(p.size);
        }
        return `${b.name}: ${[...sizes].map(([s, names]) => {
          const named = [...new Set(names.filter(Boolean))];
          return named.length ? `${s} (${named.join(", ")})` : s;
        }).join("; ")}.`;
      }).join(" ")}`,
    },
    {
      id: "shrink",
      q: "Do rolls really shrink?",
      html: `Yes, quietly, and the "= N regular" claim usually stays put. Charmin Ultra Soft Mega went from ${chMegaOld.sheets} sheets to ${chMegaNow.sheets} and still says "= ${chMegaNow.claim} regular". Charmin's ${oldSM.sheets}-sheet Ultra Strong Super Mega became a ${newXL.sheets}-sheet Mega XL. Quilted Northern sells two different Ultra Soft &amp; Strong Super Mega rolls, with ${qnSM[0].sheets} and ${qnSM[1].sheets} sheets, under one name. Read the sheet count, not the name.`,
    },
    {
      id: "cheapest",
      q: "Which brand is cheapest?",
      html: `Whichever is on sale. Prices change every week, so divide each pack's price by its total sheets (rolls × sheets per roll) and the lower number wins. ${noClaimBrands.map((b) => {
        const packs = [...new Set(buyable.filter((p) => p.brand === b.key).map((p) => p.defaultRolls))].sort((x, y) => x - y);
        return `${esc(b.name)} comes in big ${listJoin(packs.map(String))}-roll packs, so compare it per sheet, not per pack. `;
      }).join("")}<a href="/cheapest-toilet-paper-per-sheet">How to find the cheapest per sheet</a> walks through it, and <a href="/">the calculator</a> does it for you.`,
    },
    {
      id: "honest-roll",
      q: "What's an Honest Roll?",
      html: `Our own unit: ${D.honestRollSqFt} square feet of paper, about one regular roll from any of these brands. <a href="/convert">The roll converter</a> uses it so a roll from one brand can be measured against another without anyone's marketing.`,
    },
    {
      id: "sources",
      q: "Where do the numbers come from?",
      html: `From the makers first: the sheet counts, sheet sizes and "= N regular" claims on ${listJoin(brands.map((b) => esc(b.name)))}'s own sites and pack photos. When a maker doesn't print a number, we use a retailer listing for the same pack and say so. Last checked ${esc(D.checked)}. Packs change, so trust the one in your hand, and if it doesn't match, type its numbers into <strong>Custom</strong>. Every number has a link on <a href="/data#sources">Data &amp; API</a>.`,
    },
    {
      id: "softest",
      q: "Which toilet paper is the softest?",
      html: softest.length
        ? `Of the rolls we track, ${listJoin(softest.map((l) => esc(l.name)))} ${softest.length > 1 ? "score" : "scores"} highest, ${softest[0].score} out of ${S.max}. Softness has no industry standard, so the scores come from published tests and each brand's own tiers. <a href="/softness">The softness scale</a> shows every roll, with sources. Sandpaper is on there too, for scale.`
        : `We haven't rated any rolls yet. <a href="/softness">The softness scale</a> explains how we rate them.`,
    },
    {
      id: "data",
      q: "Can I use these numbers?",
      html: `Yes, they're free to use. Please link back to toiletpaper.app. <a href="/data">Data &amp; API</a> has every roll in one table and a way to get it as JSON.`,
    },
    {
      id: "affiliated",
      q: "Is this affiliated with the brands?",
      html: `No. This is an independent site, not affiliated with, sponsored by or endorsed by ${esc(brandList)}. Brand names belong to their owners. There are no ads or affiliate links, so nobody is paying us to say anything.`,
    },
  ].map((item) => ({ ...item, text: strip(item.html) }));

  const faqHTML = faq.map((item) =>
    `<details class="faq-item" id="${item.id}"><summary>${esc(item.q)}</summary><div class="faq-answer"><p>${item.html}</p></div></details>`,
  ).join("");

  // ---------- about: why sheets beat rolls ----------
  const whyCards = [
    {
      title: "A Mega isn't a Mega",
      body: `A Mega roll has anywhere from ${range(megas)} sheets, depending on the brand and line. The name tells you it's big. It doesn't tell you how big.`,
    },
    {
      title: "Regular isn't regular",
      body: `Each brand's regular roll is different: ${listJoin(claimBrands.map((b) => `${b.regular.sheets} sheets at ${esc(b.name)}`))}. So <span class="nowrap">"= 4 regular rolls"</span> means ${claimBrands.map((b) => b.regular.sheets * 4).join(", ").replace(/, ([^,]*)$/, " or $1")} sheets, depending on whose regular.`,
    },
    {
      title: "Sheets don't lie",
      body: "Price per sheet is the honest number: the price divided by rolls × sheets per roll. When sheet sizes differ a lot, compare paper area too.",
    },
  ];
  const whyHTML = '<div class="why-grid">' + whyCards.map((c) =>
    `<article class="why-card"><h3>${esc(c.title)}</h3><p>${c.body}</p></article>`,
  ).join("") + "</div>";

  const regularsSentence = listJoin(claimBrands.map((b) => `${b.name}'s is ${fix(sqFtOf(b.regular), 2)} sq ft`));
  const exampleState = Core.defaultDeal();
  const apiExample = `/api/compare?mode=sheets&a=${exampleState.packs.map((p, i) => `${i ? Core.PARAMS[i] + "=" : ""}${p.productId},${p.rolls},${p.price}`).join("&")}`;

  // ---------- pages ----------
  const pages = [];

  pages.push({
    key: "deal", path: "/", nav: "deal", app: "Toilet paper deal calculator",
    title: "Which toilet paper pack is the better deal? | Toilet Paper Math",
    ogTitle: "Which toilet paper pack is the better deal?",
    description: `Pick the ${brandList} packs on the shelf, type in the prices, and see which one costs less per sheet or per square foot.`,
    tool: "deal",
    body: `<div class="page-head">
      <h1>Which pack is the better deal?</h1>
      <p class="lede">Pick the packs on the shelf and type in the prices.</p>
    </div>
    ${TOOL_START}${Core.dealHTML(Core.defaultDeal())}${TOOL_END}
    <details class="how">
      <summary>How this works</summary>
      <ul>
        <li><strong>Sheets</strong> divides the price by the total sheets in the pack. It's the simplest comparison, but sheet sizes differ a little between brands and lines.</li>
        <li><strong>Paper area</strong> divides by square feet of paper (sheets × sheet width × sheet length), so bigger sheets count for more.</li>
        <li><strong>Area × ply</strong> also counts a 3-ply square as 1.5 times a 2-ply square.</li>
        <li><strong>What matters more</strong> picks the winner. Cheapest ignores softness. Balanced pays up to ${Core.pct(Core.BALANCE_STEP)} more per sheet for each point of softness (out of ${D.softness.max}). Softest picks the softest rated roll. <a href="/softness">How softness is rated</a>.</li>
        <li>Roll sizes come from pack labels and can change. If your pack says something different, pick <strong>Custom</strong> and type in its numbers. <a href="/data#sources">Sources and notes</a>.</li>
        <li>The address bar always holds a link to exactly what you typed, so you can share a comparison.</li>
      </ul>
    </details>`,
  });

  pages.push({
    key: "convert", path: "/convert", nav: "convert", app: "Toilet paper roll converter",
    crumbs: [{ name: "Roll converter", path: "/convert" }],
    title: "Roll converter: what Mega, Mega XL and Super Mega really mean | Toilet Paper Math",
    ogTitle: "Roll converter: what Mega, Mega XL and Super Mega really mean",
    description: `Sheets and square feet on every ${brandList} roll, and what one roll equals in each brand's regular rolls.`,
    tool: "convert",
    body: `<div class="page-head">
      <h1>Roll converter</h1>
      <p class="lede">See what's on a roll and what one of it equals in every other roll.</p>
    </div>
    ${TOOL_START}${Core.converterHTML(Core.parseConverter(new URLSearchParams()).state)}${TOOL_END}
    <details class="how">
      <summary>How this works</summary>
      <ul>
        <li><strong>Sheets</strong> compares sheets per roll. <strong>Paper area</strong> compares square feet (sheets × sheet width × sheet length). <strong>Area × ply</strong> also counts a 3-ply square as 1.5 times a 2-ply square.</li>
        <li>Each brand measures "= N regular rolls" against its own regular roll: ${listJoin(claimBrands.map((b) => `${b.regular.sheets} sheets at ${esc(b.name)}`))}.${noClaimNote}</li>
        <li>An <strong>Honest Roll</strong> is ${D.honestRollSqFt} square feet of paper, about one regular roll.</li>
        <li>Values tagged <span class="tag tag-derived">derived</span> were computed from other printed numbers. <span class="tag tag-estimated">estimated</span> means not found printed. <a href="/data#sources">Sources and notes</a>.</li>
      </ul>
    </details>`,
  });

  pages.push({
    key: "about", path: "/about", nav: "about", mainClass: "page-about", showCrumbs: true, faq,
    crumbs: [{ name: "How it works", path: "/about" }],
    title: "How it works: why sheets beat rolls | Toilet Paper Math",
    ogTitle: "How Toilet Paper Math works",
    description: `Why toilet paper is best compared by the sheet, what Mega and Mega XL mean, why "= 4 regular rolls" differs by brand, and other common questions.`,
    body: `<div class="page-head">
      <h1>How it works</h1>
      <p class="lede">The short version: ignore the name on the roll and count the sheets.</p>
    </div>

    <section class="about-section" aria-labelledby="why-title">
      <h2 id="why-title">Why sheets beat "rolls"</h2>
      ${whyHTML}
      <p class="why-cta"><a class="btn btn-primary" href="/">Compare pack prices</a> <a class="btn" href="/convert">Convert a roll</a></p>
    </section>

    <section class="about-section faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
      ${faqHTML}
    </section>`,
  });

  const apiQuery = new URLSearchParams(apiExample.split("?")[1]);
  const apiOutput = JSON.stringify(Core.compareJSON(Core.parseDeal(apiQuery, true).state), null, 2);
  const shareExample = ORIGIN + Core.dealLink({ ...exampleState, example: false }).slice(ORIGIN.length);
  pages.push({
    key: "data", path: "/data", nav: "data", mainClass: "page-data", showCrumbs: true,
    crumbs: [{ name: "Data & API", path: "/data" }],
    title: "Data & API: every roll, its sources and a JSON API | Toilet Paper Math",
    ogTitle: "Toilet Paper Math: data & API",
    description: `Sheets, sheet sizes and sources for every ${brandList} roll, plus a free JSON API and files for AI assistants.`,
    body: `<div class="page-head">
      <h1>Data &amp; API</h1>
      <p class="lede">The numbers behind the calculators. Free to use; please link back to toiletpaper.app.</p>
    </div>

    <section class="about-section" id="rolls" aria-labelledby="rolls-title">
      <h2 id="rolls-title">Every roll</h2>
      <p>Sheets per roll, sheet size and what each roll equals in its own brand's regular rolls. Select a roll to open it in the converter. An Honest Roll is ${D.honestRollSqFt} square feet of paper (${regularsSentence}).</p>
      ${factsTable(products, "Every roll: sheets, sheet size and regular-roll equivalents")}
    </section>

    <section class="about-section" id="sources" aria-labelledby="sources-title">
      <h2 id="sources-title">Sources</h2>
      <p>Manufacturer numbers come first. Where a maker's own site or pack photo gives a number, that's the value used and the first link. Retailer listings are a fallback for numbers the maker doesn't publish. Checked ${esc(D.checked)}. Numbers are approximate and change over time, sometimes without the name changing.</p>
      <p><span class="tag tag-derived">derived</span> means we computed it from other printed numbers, usually the total square feet on the pack. <span class="tag tag-estimated">estimated</span> means we couldn't find it printed and borrowed it from a sibling product. Square feet is sheets × sheet width × sheet length / 144.</p>
      ${sourcesTable()}
      <p class="disclaimer">Not affiliated with ${esc(brandList)}. Brand names belong to their owners.</p>
    </section>

    <section class="about-section" id="softness" aria-labelledby="softness-title">
      <h2 id="softness-title">Softness scores</h2>
      <p>Softness has no industry standard or printed number, so each line gets a coarse score from 1 to ${S.max}. Checked ${esc(S.checked)}. <a href="/softness">See them on the scale</a>.</p>
      ${softMethodHTML}
      ${softTableHTML()}
      <h3>Every softness source</h3>
      ${softSourcesHTML}
    </section>

    <section class="about-section" id="api" aria-labelledby="api-title">
      <h2 id="api-title">JSON API</h2>
      <p>Read-only, no key, open CORS. GET and HEAD only.</p>
      <ul>
        <li><a href="/api/products">/api/products</a>: every brand and roll, with sheets, sheet size, square feet, ply, the "= N regular" claim and sources. Cached for an hour.</li>
        <li><code>/api/compare?mode=sheets&amp;a=&lt;id&gt;,&lt;rolls&gt;,&lt;price&gt;&amp;b=...</code>: 2 to ${Core.MAX_PACKS} packs. Returns the price per 100 sheets, per sq ft and per sq ft × ply for each pack, the winner (or a tie) and a link to the same comparison in the calculator. Bad input gets a 400 with a JSON <code>error</code>.</li>
        <li><a href="/openapi.json">/openapi.json</a>: both endpoints in OpenAPI 3.1.</li>
      </ul>
      <p>For example, <a href="${esc(apiExample)}">${esc(apiExample)}</a> returns:</p>
      <pre class="code-block"><code>${esc(apiOutput)}</code></pre>
    </section>

    <section class="about-section" id="links" aria-labelledby="links-title">
      <h2 id="links-title">Links that keep state</h2>
      <p>The calculator keeps what you typed in its address, so a link opens the same comparison:</p>
      <p><code>${esc(shareExample)}</code></p>
      <ul>
        <li><code>mode</code>: <code>sheets</code>, <code>area</code> or <code>areaply</code>.</li>
        <li><code>a</code> to <code>${Core.PARAMS[Core.MAX_PACKS - 1]}</code>: one pack each, <code>&lt;product id&gt;,&lt;rolls&gt;,&lt;price&gt;</code>. The price may be empty. A roll that isn't listed is <code>custom:&lt;sheets&gt;:&lt;width&gt;x&lt;length&gt;:&lt;ply&gt;</code>, with sheet sides in inches.</li>
        <li>The roll converter takes <code>/convert?roll=&lt;product id&gt;&amp;mode=area</code>.</li>
      </ul>
      <p>Bad values are ignored and the page falls back to its defaults.</p>
    </section>

    <section class="about-section" id="assistants" aria-labelledby="assistants-title">
      <h2 id="assistants-title">For AI assistants</h2>
      <ul>
        <li><a href="/llms.txt">/llms.txt</a>: a short guide to the site, the API and the link format.</li>
        <li><a href="/llms-full.txt">/llms-full.txt</a>: every roll, the method and the FAQ as plain text.</li>
        <li><a href="/openapi.json">/openapi.json</a>: the API description.</li>
      </ul>
    </section>`,
  });

  pages.push({
    key: "softness", path: "/softness", nav: "softness", mainClass: "page-softness", showCrumbs: true,
    crumbs: [{ name: "Softness", path: "/softness" }],
    title: "Softness scale: which toilet paper is softest? | Toilet Paper Math",
    ogTitle: "The toilet paper softness scale",
    description: `How soft ${brandAnd} toilet paper is, from 1 to ${S.max}, scored from published tests. Sandpaper included for scale.`,
    itemList: { name: "Toilet paper lines from least to most soft", items: ratedLines.map((l) => ({ name: `${l.name}: ${l.score} out of ${S.max}`, path: convLink(l.products[0]) })) },
    body: `<div class="page-head">
      <h1>The softness scale</h1>
      <p class="lede">Every roll we could rate, from rough to fluffy. It gets softer as you scroll.</p>
    </div>
    <p class="soft-legend">Scores run from 1 to ${S.max}, built from published tests and each brand's own tiers. A few things that aren't toilet paper are on here for scale, and they're labeled.</p>
    ${softScaleHTML()}
    ${unratedLines.length ? `<section class="about-section" aria-labelledby="unrated-title"><h2 id="unrated-title">Not rated</h2><p>We couldn't find a good source for these, so they stay off the scale instead of getting a guess:</p><ul class="soft-items soft-unrated">${unratedLines.map((l) => `<li class="soft-item ${l.products[0].brand}"><span class="soft-item-name">${esc(l.name)}</span><span class="soft-sizes">${sizeLinks(l)}</span></li>`).join("")}</ul></section>` : ""}
    <p class="soft-cta"><a class="btn btn-primary" href="/?p=balanced">Compare packs with softness</a> <span class="hint">The calculator can pick the cheapest, the softest or a balance of both.</span></p>
    <section class="about-section" aria-labelledby="soft-how-title">
      <h2 id="soft-how-title">How the scores work</h2>
      ${softMethodHTML}
      <p>Regular rolls are each brand's measuring unit, not a pack you buy, so they aren't on the scale. Custom rolls in the calculator are never rated.</p>
      ${softTableHTML()}
      <p>Every source, with dates, is on <a href="/data#softness">Data &amp; API</a>.</p>
    </section>`,
  });

  // ---------- guides ----------
  const chMega = byId["charmin-ultra-soft-mega"];
  const chStrong = byId["charmin-ultra-strong-mega"];
  const qnPlush = byId["quilted-northern-ultra-plush-mega"];
  const qnUss = byId["quilted-northern-ultra-soft-strong-mega"];
  const vsRows = [chMega, chStrong, qnPlush, qnUss];
  const moreSheets = qnUss.sheets / chMega.sheets - 1;
  const moreArea = sqFtOf(qnUss) / sqFtOf(chMega) - 1;

  pages.push({
    key: "guide", path: "/charmin-mega-vs-quilted-northern-mega", showCrumbs: true, guide: true,
    crumbs: [{ name: "Charmin Mega vs Quilted Northern Mega", path: "/charmin-mega-vs-quilted-northern-mega" }],
    title: "Charmin Mega vs Quilted Northern Mega: sheets, size and value | Toilet Paper Math",
    ogTitle: "Charmin Mega vs Quilted Northern Mega",
    description: `Quilted Northern Mega has ${qnUss.sheets} sheets per roll and Charmin Ultra Soft Mega has ${chMega.sheets}. Sheet sizes, ply, paper area and what "= 4 regular rolls" means for each.`,
    body: `<div class="page-head prose">
      <h1>Charmin Mega vs Quilted Northern Mega</h1>
      <p class="answer">A Quilted Northern Mega roll has <strong>${qnUss.sheets} sheets</strong>. A Charmin Ultra Soft Mega roll has <strong>${chMega.sheets}</strong> and Ultra Strong Mega has ${chStrong.sheets}. Quilted Northern's sheets are a little shorter (${qnUss.length} in vs ${chMega.length} in), so its Ultra Soft & Strong Mega has ${pct(moreSheets)} more sheets but ${pct(moreArea)} more paper than Charmin Ultra Soft Mega.</p>
    </div>
    <section class="prose" aria-labelledby="g1">
      <h2 id="g1">Side by side</h2>
      ${factsTable(vsRows, "Charmin Mega and Quilted Northern Mega rolls compared")}
      <h2>Both say "= 4 regular rolls"</h2>
      <p>They don't count the same regular roll. Charmin's works out to ${byId["charmin-regular"].sheets} sheets (a ${chMega.sheets}-sheet Mega divided by 4). Quilted Northern's pack says its regular roll has ${byId["quilted-northern-regular"].sheets} sheets. So the same claim means ${chMega.sheets} sheets on one pack and ${4 * byId["quilted-northern-regular"].sheets} on the other.</p>
      <h2>Which is the better deal?</h2>
      <p>That depends on the shelf price, which changes weekly, so this page doesn't guess. Divide each pack's price by its total sheets: the lower number is the better deal per sheet. <a href="${esc(dealLink([chMega, qnUss]))}">Open the calculator with both packs</a> and type in the prices you see.</p>
      <p>For a third option, Angel Soft Mega has ${byId["angel-soft-mega"].sheets} sheets of ${sizeText(byId["angel-soft-mega"])}, ${fix(sqFtOf(byId["angel-soft-mega"]), 1)} sq ft per roll, and also says "= ${byId["angel-soft-mega"].claim} regular" (Angel Soft's regular roll works out to ${byId["angel-soft-regular"].sheets} sheets).</p>
      <p>Ply matters too: Quilted Northern Ultra Plush is ${qnPlush.ply}-ply, while Charmin Mega and Quilted Northern Ultra Soft & Strong are ${chMega.ply}-ply. Pick <strong>Area × ply</strong> in the calculator to count it.</p>
      <h2>What about the bigger rolls?</h2>
      <p>Charmin's next size up is Mega XL (${byId["charmin-ultra-soft-mega-xl"].sheets} sheets in Ultra Soft). Quilted Northern's is Super Mega (${byId["quilted-northern-ultra-plush-super-mega"].sheets} sheets in Ultra Plush). Both say "= 6 regular". <a href="/how-many-sheets-in-a-mega-roll">Every Mega size</a> lists them all.</p>
    </section>`,
  });

  const megaFamily = products.filter((p) => !p.isRegular && /Mega/.test(p.size)).sort((a, b) => brandKeys.indexOf(a.brand) - brandKeys.indexOf(b.brand) || a.sheets - b.sheets);
  const chOld = D.history["charmin-ultra-soft-mega"];
  pages.push({
    key: "guide", path: "/how-many-sheets-in-a-mega-roll", showCrumbs: true, guide: true,
    crumbs: [{ name: "How many sheets in a Mega roll?", path: "/how-many-sheets-in-a-mega-roll" }],
    title: "How many sheets are in a Mega roll? Every brand and size | Toilet Paper Math",
    ogTitle: "How many sheets are in a Mega roll?",
    description: `Sheets per roll for every Mega, Mega XL, Mega XXL and Super Mega roll from ${listJoin(brands.filter((b) => megaFamily.some((p) => p.brand === b.key)).map((b) => b.name))}, with sheet sizes and regular-roll equivalents.`,
    body: `<div class="page-head prose">
      <h1>How many sheets are in a Mega roll?</h1>
      <p class="answer">${brands.map((b) => {
        const m = megas.filter((p) => p.brand === b.key);
        return m.length ? `${listJoin(m.map((p) => `${esc(fullName(p))} has <strong>${p.sheets} sheets</strong>`))}.` : "";
      }).filter(Boolean).join(" ")}</p>
    </div>
    <section class="prose" aria-labelledby="m1">
      <h2 id="m1">Every Mega size</h2>
      ${factsTable(megaFamily, "Sheets per roll for every Mega size")}
      <h2>Why the same name means different rolls</h2>
      <p>"Mega" is a size name, not a sheet count. Each brand and line sets its own, and it changes: older Charmin Ultra Soft Mega listings showed ${chOld.sheets} sheets, and today's roll has ${chMega.sheets}, still sold as "= ${chMega.claim} regular rolls".</p>
      <p>Sheet size differs too, so sheet counts alone don't tell you how much paper you get. The <a href="/convert">roll converter</a> shows sheets, square feet and ply for each roll.</p>
    </section>`,
  });

  const ex = Core.computeDeal(exampleState);
  const exRows = ex.results.map((r, i) => `<li>Pack ${Core.LETTERS[i]}: ${esc(fullName(byId[r.pack.productId]))}, ${r.rolls} rolls × ${r.spec.sheets} sheets = ${fix(r.totalSheets, 0)} sheets. $${fix(r.price, 2)} ÷ ${fix(r.totalSheets, 0)} × 100 = <strong>${fix(r.cost.sheets * 10000, 1)}¢ per 100 sheets</strong>.</li>`).join("");
  pages.push({
    key: "guide", path: "/cheapest-toilet-paper-per-sheet", showCrumbs: true, guide: true,
    crumbs: [{ name: "Cheapest toilet paper per sheet", path: "/cheapest-toilet-paper-per-sheet" }],
    title: "How to find the cheapest toilet paper per sheet | Toilet Paper Math",
    ogTitle: "How to find the cheapest toilet paper per sheet",
    description: "Divide the price by the total sheets in the pack. A short, worked method for comparing toilet paper per sheet and per square foot, and why shelf tags mislead.",
    body: `<div class="page-head prose">
      <h1>How to find the cheapest toilet paper per sheet</h1>
      <p class="answer">Divide the pack's price by its total sheets (rolls × sheets per roll), then multiply by 100 to get the price per 100 sheets. The pack with the lower number is cheaper per sheet.</p>
    </div>
    <section class="prose" aria-labelledby="c1">
      <h2 id="c1">The method</h2>
      <ol>
        <li>Find the sheets per roll on the pack. It's usually in small print near the roll count.</li>
        <li>Multiply by the number of rolls to get the total sheets.</li>
        <li>Divide the price by the total sheets and multiply by 100.</li>
        <li>Do the same for every pack and compare.</li>
      </ol>
      <h2>A worked example</h2>
      <p>With made-up prices (they're examples, not real store prices):</p>
      <ul>${exRows}</ul>
      <p>${esc(Core.resultSentence(exampleState, ex))}</p>
      <h2>Why shelf tags mislead</h2>
      <ul>
        <li>Store unit prices use different units: per roll, per 100 sheets or per square foot, sometimes on the same shelf.</li>
        <li>"Per roll" hides the roll size. A Mega roll from one brand isn't a Mega roll from another.</li>
        <li>"= N regular rolls" uses each brand's own regular roll, and they differ (${listJoin(claimBrands.map((b) => `${b.regular.sheets} sheets at ${esc(b.name)}`))}).${noClaimNote}</li>
      </ul>
      <h2>Per sheet or per square foot?</h2>
      <p>Per sheet is the simplest. When sheet sizes differ, price per square foot is fairer. <a href="/">The calculator</a> shows both, and Area × ply if you care about thickness.</p>
    </section>`,
  });

  const guides = pages.filter((p) => p.guide);

  pages.push({
    key: "notfound", path: "/404", noindex: true, sitemap: false, mainClass: "lost",
    title: "Page not found | Toilet Paper Math",
    description: "That page doesn't exist. Try the deal calculator or the roll converter.",
    body: `<h1>Out of paper</h1>
    <p>That page doesn't exist.</p>
    <p><a class="btn btn-primary" href="/">Compare pack prices</a> <a class="btn" href="/convert">Convert a roll</a></p>
    <ul class="lost-links">${[{ path: "/about", crumbs: [{ name: "How it works" }] }, ...guides].map((g) => `<li><a href="${g.path}">${esc(g.crumbs[0].name)}</a></li>`).join("")}</ul>`,
  });

  return { pages, faq, guides, brands, brandList, siteDescription, apiExample, softLines, ratedLines, unratedLines, softBand };
}
