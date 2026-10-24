// Every HTML page on the site. Numbers in the copy come from data.js through TPCore, so the
// tables, FAQ answers, API and llms.txt can't disagree with each other.

import { ORIGIN } from "./config.mjs";
import { TOOL_END, TOOL_START, esc } from "./layout.mjs";

export function buildSite(D, Core) {
  const { byId, fix, pct, sqFtOf, fullName, shortName, sizeText, tag, sourceLinks } = Core;
  const brandKeys = Object.keys(D.brands);
  const brands = brandKeys.map((k) => ({ key: k, ...D.brands[k], regular: byId[D.brands[k].regularId] }));
  const brandList = brands.map((b) => b.name).join(", ").replace(/, ([^,]*)$/, " or $1");
  const brandAnd = brands.map((b) => b.name).join(", ").replace(/, ([^,]*)$/, " and $1");
  const listJoin = (items) => items.length < 3 ? items.join(" and ") : items.slice(0, -1).join(", ") + " and " + items.at(-1);
  const products = D.products;
  const buyable = products.filter((p) => !p.isRegular);
  const ofBrand = (b) => products.filter((p) => p.brand === b);
  const regularRolls = (p) => p.sheets / byId[D.brands[p.brand].regularId].sheets;
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
        `<td class="num">${p.isRegular ? "the yardstick" : `= ${p.claim} regular`}</td>` +
        `<td class="num">${fix(regularRolls(p), 2)}</td></tr>`;
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
          `<td class="num">${p.ply}</td><td class="num">${p.isRegular ? "the yardstick" : `= ${p.claim} regular`}</td>` +
          `<td class="num">${fix(sq, 2)}</td><td>${printed}</td><td>${sourceLinks(p)}</td></tr>`;
      }
    }
    return html + "</tbody></table></div>";
  }

  // ---------- FAQ (visible on /about, and the same text in FAQPage JSON-LD) ----------
  const megas = products.filter((p) => p.size === "Mega");
  const sizeList = (list) => listJoin(list.map((p) => `${fullName(p)}: ${p.sheets}`));
  const faq = [
    {
      q: "How many sheets are in a Mega roll?",
      html: `It depends on the brand and the line. ${brands.map((b) => {
        const m = megas.filter((p) => p.brand === b.key);
        return m.length ? sizeList(m) + "." : "";
      }).filter(Boolean).join(" ")} See <a href="/how-many-sheets-in-a-mega-roll">every Mega size</a>.`,
    },
    {
      q: "What does \"= 4 regular rolls\" mean?",
      html: `Each brand compares its big rolls to its own regular roll, and the brands don't agree on what a regular roll is. ${brands.map((b) =>
        `${b.name}'s regular roll is ${b.regular.sheets} sheets`).join(", ")}. So "= 4 regular rolls" means ${listJoin(brands.map((b) => `${b.regular.sheets * 4} sheets at ${b.name}`))}.`,
    },
    {
      q: "Is Mega XL the same as Super Mega?",
      html: (() => {
        const old = byId["charmin-ultra-strong-super-mega-older"];
        const xl = byId["charmin-ultra-strong-mega-xl"];
        const qn = products.filter((p) => p.brand === "qn" && p.size === "Super Mega");
        const angel = byId["angel-soft-mega-xl"];
        return `At Charmin, Mega XL replaced Super Mega. The older Ultra Strong Super Mega had ${old.sheets} sheets and today's Ultra Strong Mega XL has ${xl.sheets}, and both say "= ${xl.claim} regular". ` +
          `Quilted Northern still sells Super Mega, with ${listJoin([...new Set(qn.map((p) => p.sheets))].sort((a, b) => a - b).map(String))} sheets depending on the line and pack. ` +
          `Angel Soft's Mega XL (${angel.sheets} sheets) is sold as Super Mega at some grocers.`;
      })(),
    },
    {
      q: "How big is a sheet of toilet paper?",
      html: `About 4 inches by 4 inches, but it varies. ${brands.map((b) => {
        const sizes = new Map();
        for (const p of buyable.filter((x) => x.brand === b.key)) {
          const key = sizeText(p);
          if (!sizes.has(key)) sizes.set(key, []);
          sizes.get(key).push(p.size);
        }
        return `${b.name}: ${[...sizes].map(([s, names]) => `${s} (${[...new Set(names)].join(", ")})`).join("; ")}.`;
      }).join(" ")}`,
    },
    {
      q: "Should I compare toilet paper by sheet count or by paper area?",
      html: "Sheet count is the simplest and is what most people mean by \"how much paper\". Paper area (sheets × sheet width × sheet length) is fairer when sheet sizes differ. Area × ply also counts thickness, so a 3-ply sheet counts 1.5 times a 2-ply one. The calculator shows all three.",
    },
    {
      q: `Which is cheaper, ${brands[0].name} or ${brands[1].name}?`,
      html: `It depends on the prices in front of you, and they change every week. Divide each pack's price by its total sheets (rolls × sheets per roll) and the lower number wins. <a href="/">The calculator</a> does it for you, by sheet count or by paper area.`,
    },
  ].map((item) => ({ ...item, text: strip(item.html) }));

  const faqHTML = faq.map((item) => `<h3>${esc(item.q)}</h3><p>${item.html}</p>`).join("");

  // ---------- about: regular rolls and shrinkflation ----------
  function regularCards() {
    return '<div class="regular-grid">' + brands.map((b) => {
      const r = b.regular;
      return `<article class="regular-card ${b.key}"><h3><span class="brand-dot"></span><span>${esc(b.name)}: ${r.sheets} sheets</span></h3>` +
        `<p>${esc(r.note)}${r.flags.sheets ? tag(r.flags.sheets) : ""}${r.flags.size ? tag(r.flags.size + " size") : ""}</p>` +
        `<p class="hint">${sizeText(r)} sheets, ${r.ply}-ply, ${fix(sqFtOf(r), 2)} sq ft per roll.</p></article>`;
    }).join("") + "</div>";
  }

  function versus(rows, brand) {
    const max = Math.max(...rows.map((r) => r.sheets));
    return '<div class="versus">' + rows.map((r) =>
      `<div class="versus-row"><span>${esc(r.label)}</span><span class="versus-bar ${r.brand || brand}${r.faded ? " faded" : ""}" style="width:${(r.sheets / max * 100).toFixed(1)}%">${r.sheets}</span></div>`,
    ).join("") + "</div>";
  }
  const claimStamp = (n) => `<span class="claim-stamp">"= ${n} regular"</span>`;

  function shrinkCards() {
    const chMega = byId["charmin-ultra-soft-mega"];
    const chOld = D.history["charmin-ultra-soft-mega"];
    const s6 = byId["quilted-northern-ultra-soft-strong-super-mega-378"];
    const s8 = byId["quilted-northern-ultra-soft-strong-super-mega-438"];
    const oldSM = byId["charmin-ultra-strong-super-mega-older"];
    const newXL = byId["charmin-ultra-strong-mega-xl"];
    const qnMega = byId["quilted-northern-ultra-soft-strong-mega"];
    const qnOld = D.history["quilted-northern-ultra-soft-strong-mega"];
    const cards = [
      {
        stamp: "Shrank", title: "Charmin Ultra Soft Mega",
        bars: versus([{ label: chOld.label, sheets: chOld.sheets, faded: true }, { label: "Now", sheets: chMega.sheets }], "charmin"),
        body: `${chOld.sheets - chMega.sheets} fewer sheets per roll (${pct(1 - chMega.sheets / chOld.sheets)} less), still ${claimStamp(chMega.claim)}. If both claims are true, Charmin's regular roll went from ${chOld.sheets / chMega.claim} sheets to ${chMega.sheets / chMega.claim}.`,
      },
      {
        stamp: "Same name", title: "QN Ultra Soft & Strong Super Mega",
        bars: versus([{ label: "One pack", sheets: s8.sheets }, { label: "Another", sheets: s6.sheets }], "qn"),
        body: `One name, two rolls: ${s8.sheets} sheets and ${s6.sheets} sheets. Both say ${claimStamp(s6.claim)}, so the regular roll is ${s6.sheets / s6.claim} sheets on one pack and ${s8.sheets / s8.claim} on the other.`,
      },
      {
        stamp: "Renamed", title: "Charmin Super Mega is now Mega XL",
        bars: versus([{ label: "Super Mega", sheets: oldSM.sheets, faded: true }, { label: "Mega XL", sheets: newXL.sheets }], "charmin"),
        body: `In Ultra Strong, the older Super Mega pack had ${oldSM.sheets} sheets and today's Mega XL has ${newXL.sheets}, ${oldSM.sheets - newXL.sheets} fewer (${pct(1 - newXL.sheets / oldSM.sheets)}). Both say ${claimStamp(newXL.claim)}.`,
      },
      {
        stamp: "Bragging", title: `QN: "${qnMega.sheets} sheets vs ${chMega.sheets}"`,
        bars: versus([
          { label: "QN, older", sheets: qnOld.sheets, brand: "qn", faded: true },
          { label: "QN Mega now", sheets: qnMega.sheets, brand: "qn" },
          { label: "Charmin Mega", sheets: chMega.sheets, brand: "charmin" },
        ]),
        body: `Quilted Northern's site compares its ${qnMega.sheets}-sheet Mega to the "national leading brand" Mega at ${chMega.sheets}. By paper area that's ${pct(sqFtOf(qnMega) / sqFtOf(chMega) - 1)} more. Older QN Ultra Soft & Strong Mega packs had ${qnOld.sheets} sheets.`,
      },
    ];
    return '<div class="shrink-grid">' + cards.map((c) =>
      `<article class="shrink-card"><span class="stamp">${esc(c.stamp)}</span><h3>${esc(c.title)}</h3>${c.bars}<p>${c.body}</p></article>`,
    ).join("") + "</div>";
  }

  const regularsSentence = listJoin(brands.map((b) => `${b.name}'s is ${fix(sqFtOf(b.regular), 2)} sq ft`));
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
        <li>Roll sizes come from pack labels and can change. If your pack says something different, pick <strong>Custom</strong> and type in its numbers. <a href="/about">Sources and notes</a>.</li>
        <li>The address bar always holds a link to exactly what you typed, so you can share a comparison.</li>
      </ul>
    </details>`,
  });

  pages.push({
    key: "convert", path: "/convert", nav: "convert", app: "Toilet paper roll converter",
    crumbs: [{ name: "Roll converter", path: "/convert" }],
    title: "Roll converter: what Mega, Mega XL and Super Mega really mean | Toilet Paper Math",
    ogTitle: "Roll converter: what Mega, Mega XL and Super Mega really mean",
    description: `See how many sheets and square feet are on every ${brandList} roll, and what one roll equals in each brand's regular rolls.`,
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
        <li>Each brand measures "= N regular rolls" against its own regular roll: ${listJoin(brands.map((b) => `${b.regular.sheets} sheets at ${esc(b.name)}`))}.</li>
        <li>An <strong>Honest Roll</strong> is ${D.honestRollSqFt} square feet of paper, about one regular roll.</li>
        <li>Values tagged <span class="tag tag-derived">derived</span> were computed from other printed numbers. <span class="tag tag-estimated">estimated</span> means not found printed. <a href="/about">Sources and notes</a>.</li>
      </ul>
    </details>`,
  });

  pages.push({
    key: "about", path: "/about", nav: "about", mainClass: "page-about", showCrumbs: true, faq,
    crumbs: [{ name: "How it works", path: "/about" }],
    title: "How it works and sources | Toilet Paper Math",
    ogTitle: "How Toilet Paper Math works",
    description: `Why "= 4 regular rolls" differs by brand, sheet counts and sizes for every roll, common questions answered, and a source for every number.`,
    body: `<div class="page-head">
      <h1>How it works</h1>
      <p class="lede">Why "= 4 regular rolls" doesn't mean the same thing at every brand, and where every number comes from.</p>
    </div>

    <section class="about-section" aria-labelledby="regular-title">
      <h2 id="regular-title">Each brand has its own "regular roll"</h2>
      ${regularCards()}
      <p>So "= 4 regular rolls" means ${listJoin(brands.map((b) => `${b.regular.sheets * 4} sheets at ${esc(b.name)}`))}, on different sized sheets.</p>
      <p>To compare fairly by size, the converter also uses an <strong>Honest Roll: ${D.honestRollSqFt} square feet of paper</strong>. That's about one regular roll from any of these brands (${regularsSentence}).</p>
    </section>

    <section class="about-section" aria-labelledby="facts-title">
      <h2 id="facts-title">Every roll, in sheets and regular rolls</h2>
      <p>Sheets per roll, sheet size and what each roll equals in its own brand's regular rolls. Select a roll to open it in the converter.</p>
      ${factsTable(products, "Every roll: sheets, sheet size and regular-roll equivalents")}
    </section>

    <section class="about-section" aria-labelledby="shrink-title">
      <h2 id="shrink-title">Shrinkflation corner</h2>
      <p>Rolls change. Names don't always change with them, and the "= N regular" claim almost never does.</p>
      ${shrinkCards()}
    </section>

    <section class="about-section faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
      ${faqHTML}
    </section>

    <section class="about-section" id="data" aria-labelledby="data-title">
      <h2 id="data-title">Data and links</h2>
      <p>The numbers on this site are free to use. Please link back to toiletpaper.app.</p>
      <ul>
        <li><a href="/api/products">/api/products</a>: every roll as JSON.</li>
        <li><a href="${esc(apiExample)}">/api/compare</a>: compare packs by price, as JSON.</li>
        <li><a href="/openapi.json">/openapi.json</a>: the API described in OpenAPI 3.1.</li>
        <li><a href="/llms.txt">/llms.txt</a>: a short guide to the site for AI assistants.</li>
      </ul>
      <p>Links to the calculator keep what you typed, for example <code>${esc(ORIGIN + Core.dealLink({ ...exampleState, example: false }).slice(ORIGIN.length))}</code>.</p>
    </section>

    <section class="about-section" id="sources" aria-labelledby="sources-title">
      <h2 id="sources-title">Sources</h2>
      <p>Every number comes from packaging text on manufacturer and retailer listings, checked ${esc(D.checked)}. They're approximate and change over time, sometimes without the name changing. Check the pack in your hand, and if it doesn't match, use <strong>Custom</strong> in the deal calculator.</p>
      <p><span class="tag tag-derived">derived</span> means we computed it from other printed numbers, usually the total square feet on the pack. <span class="tag tag-estimated">estimated</span> means we couldn't find it printed and borrowed it from a sibling product. Square feet is sheets × sheet width × sheet length / 144.</p>
      ${sourcesTable()}
      <p class="disclaimer">Not affiliated with ${esc(brandList)}. Brand names belong to their owners.</p>
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
    description: `Sheets per roll for every Mega, Mega XL, Mega XXL and Super Mega roll from ${brandAnd}, with sheet sizes and regular-roll equivalents.`,
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
        <li>"= N regular rolls" uses each brand's own regular roll, and they differ (${listJoin(brands.map((b) => `${b.regular.sheets} sheets at ${esc(b.name)}`))}).</li>
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
    <ul class="footer-links lost-links">${[{ path: "/about", crumbs: [{ name: "How it works" }] }, ...guides].map((g) => `<li><a href="${g.path}">${esc(g.crumbs[0].name)}</a></li>`).join("")}</ul>`,
  });

  const footerLinks = [
    ...guides.map((g) => ({ path: g.path, label: g.crumbs[0].name })),
    { path: "/about#sources", label: "Sources" },
    { path: "/about#data", label: "Data and API" },
  ];

  return { pages, faq, guides, brands, brandList, siteDescription, footerLinks, apiExample };
}
