// The non-HTML files the build generates: robots.txt, sitemap.xml, llms.txt, llms-full.txt,
// openapi.json, site.webmanifest, /api/products and the IndexNow key file. They come from the
// same data and page registry as the HTML.

import { INDEXNOW_KEY, ORIGIN, SITE_NAME, UPDATED } from "./config.mjs";

// Crawlers for AI assistants and search engines. All of them may read everything.
export const CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended",
  "Googlebot", "Bingbot", "Applebot", "DuckDuckBot",
];

export function buildFiles(D, Core, site, assetUrl) {
  const indexed = site.pages.filter((p) => !p.noindex);
  const abs = (path) => ORIGIN + (path === "/" ? "/" : path);
  const brands = site.brands;
  const exampleLink = Core.dealLink({ ...Core.defaultDeal(), example: false });
  const compareExample = ORIGIN + site.apiExample;

  const robots =
    CRAWLERS.map((bot) => `User-agent: ${bot}\nAllow: /\n`).join("\n") +
    `\nUser-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    indexed.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${UPDATED}</lastmod></url>\n`).join("") +
    "</urlset>\n";

  const pageLine = (p) => `- [${p.ogTitle || p.title.replace(/ \| .*$/, "")}](${abs(p.path)}): ${p.description}`;
  const tools = indexed.filter((p) => p.tool);
  const guides = indexed.filter((p) => p.guide);
  const about = indexed.find((p) => p.key === "about");

  const deepLinks = `## Links that open with numbers filled in

The deal calculator reads its state from the query string, so a link can open a ready comparison:

\`${ORIGIN}/?mode=<mode>&a=<product id>,<rolls>,<price>&b=...\`

- \`mode\`: \`sheets\` (price per sheet), \`area\` (price per square foot) or \`areaply\` (per square foot, counting ply).
- \`p\`: what matters more. \`cheap\` (default, lowest price wins), \`balanced\` or \`soft\` (softest rated pack wins). See "Softness" below.
- \`a\` to \`h\`: up to ${Core.MAX_PACKS} packs. Each is a product id from /api/products, the number of rolls and the price in dollars. The price may be left empty.
- A roll that isn't listed: \`custom:<sheets>:<width>x<length>:<ply>\`, with sheet sides in inches, for example \`custom:300:4x4:2,12,15.99\`.
- Example: ${exampleLink}

The roll converter takes \`${ORIGIN}/convert?roll=<product id>&mode=<mode>\`, for example ${ORIGIN}/convert?roll=quilted-northern-ultra-plush-mega&mode=area.

Bad or unknown values are ignored and the page falls back to its defaults.`;

  const api = `## Data and API

Read-only JSON, free to use with a link back. CORS is open.

- [${ORIGIN}/api/products](${ORIGIN}/api/products): every brand and roll with sheets per roll, sheet size, square feet, ply, what it equals in regular rolls, its softness score (or null when not rated) with sources, and its source.
- [${ORIGIN}/api/compare](${compareExample}): \`GET /api/compare?mode=sheets&p=cheap&a=<id>,<rolls>,<price>&b=...\` (2 to ${Core.MAX_PACKS} packs) returns the cost per 100 sheets, per square foot and per square foot × ply for each pack, its softness score, the winner for the priority \`p\`, the percent difference and a link to the same comparison in the calculator.
- [${ORIGIN}/openapi.json](${ORIGIN}/openapi.json): OpenAPI 3.1 description of both endpoints.
- [${ORIGIN}/data](${ORIGIN}/data): the same docs for people, with the full roll table and a source for every number.`;

  const S = D.softness;
  const softPage = indexed.find((p) => p.key === "softness");
  const softSources = (l) => l.sources.map((id) => `${S.sources[id].publisher} (${S.sources[id].dateKind} ${S.sources[id].date}, ${S.sources[id].url})`).join("; ");
  const softness = `## Softness

${pageLine(softPage)}

Softness has no industry standard, so each line gets a coarse score from 0 to ${S.max}. A line with no good source is "not rated" instead of guessed. Checked ${S.checked}.

${S.method.map((m) => `- ${m}`).join("\n")}

What matters more (\`p\` in calculator links and /api/compare):

- \`cheap\` (default): the lowest price per unit wins. Softness doesn't count.
- \`balanced\`: start from the cheapest pack. A softer pack wins if it costs at most ${Core.pct(Core.BALANCE_STEP)} more per unit for each softness point it gains over the cheapest (2 points softer may cost up to ${Core.pct(Core.BALANCE_STEP * 2)} more). Of the packs that qualify, the softest wins, then the cheaper. If the cheapest pack isn't rated, Balanced can't weigh it and keeps the cheapest.
- \`soft\`: the softest rated pack wins; the cheaper one breaks a tie. Packs that aren't rated are left out. If no pack is rated, the cheapest wins.`;
  const softTable =
    "| Line | Score | Why | Sources |\n|---|---|---|---|\n" +
    [...site.ratedLines.slice().reverse(), ...site.unratedLines].map((l) =>
      `| ${l.name.replace(/\|/g, "\\|")} | ${l.score != null ? `${l.score}/${S.max}` : "not rated"} | ${(l.why || "").replace(/\|/g, "\\|")} | ${l.sources.length ? softSources(l).replace(/\|/g, "\\|") : "none found"} |`).join("\n");

  const llms = `# ${SITE_NAME}

> Free calculators for comparing ${site.brandList} toilet paper packs by price per sheet and per square foot, and for decoding roll names like Mega, Mega XL and Super Mega. Each brand's "= N regular rolls" claim uses its own regular roll (${brands.filter((b) => b.regular).map((b) => `${b.name} ${b.regular.sheets} sheets`).join(", ")}${brands.some((b) => !b.regular) ? `; ${brands.filter((b) => !b.regular).map((b) => b.name).join(", ")} makes no such claim` : ""}), so the site compares actual sheets and paper area instead. Sheet counts come from pack labels, checked ${D.checked}.

## Tools

${tools.map(pageLine).join("\n")}

## Guides

${guides.map(pageLine).join("\n")}
${pageLine(about)}

${softness}

${api}

${deepLinks}

## More

- [${ORIGIN}/llms-full.txt](${ORIGIN}/llms-full.txt): every roll in one table, the method and the FAQ, as plain text.
`;

  const md = (s) => String(s).replace(/\|/g, "\\|");
  const table =
    "| Roll | Product id | Sheets per roll | Sheet size (in) | Ply | Sq ft per roll | Pack says | Regular rolls by sheets | Source |\n" +
    "|---|---|---|---|---|---|---|---|---|\n" +
    D.products.map((p) => {
      const reg = Core.regularOf(p.brand);
      const src = (p.sources || []).find((s) => s.url);
      return `| ${md(Core.fullName(p))} | ${p.id} | ${p.sheets}${p.flags.sheets ? ` (${p.flags.sheets})` : ""} | ${p.width} × ${p.length}${p.flags.size ? ` (${p.flags.size})` : ""} | ${p.ply} | ${Core.fix(Core.sqFtOf(p), 2)} | ${p.isRegular ? "regular roll" : p.claim == null ? "no claim" : `= ${p.claim} regular`} | ${reg ? Core.fix(p.sheets / reg.sheets, 2) : "n/a"} | ${src ? src.url : md(p.source)} |`;
    }).join("\n");

  const llmsFull = `# ${SITE_NAME}: full reference

> ${site.siteDescription} Numbers checked ${D.checked}. Sources: ${ORIGIN}/data#sources

## Every roll

${table}

"derived" means computed from other printed numbers (usually the total square feet on the pack). "estimated" means not found printed and taken from a sibling product. Square feet per roll is sheets × sheet width × sheet length / 144.

## Method

1. Total sheets in a pack = rolls × sheets per roll.
2. Price per 100 sheets = price ÷ total sheets × 100. The lower number is the better deal per sheet.
3. Price per square foot = price ÷ (total sheets × sheet width × sheet length / 144). Fairer when sheet sizes differ.
4. Price per square foot × ply = price ÷ (square feet × ply / 2). Counts a 3-ply sheet as 1.5 times a 2-ply one.
5. Results within 0.5% of each other are treated as a tie.

An Honest Roll is ${D.honestRollSqFt} square feet of paper, about one regular roll from any of these brands.

${softness}

${softTable}

Regular rolls are each brand's measuring unit, not a pack you buy, so they aren't rated. Custom rolls are never rated. A few reference points that aren't products are on the /softness scale for comparison (${S.anchors.map((a) => `${a.name.toLowerCase()} at ${a.score}`).join(", ").replace(/, ([^,]*)$/, " and $1")}). They aren't in the calculator or the API.

## Questions

${site.faq.map((f) => `### ${f.q}\n\n${f.text}`).join("\n\n")}

${api}

${deepLinks}
`;

  const productSchema = {
    type: "object",
    required: ["id", "brand", "name", "sheetsPerRoll", "sheetWidthIn", "sheetLengthIn", "sqFtPerRoll", "ply", "isRegularRoll"],
    properties: {
      id: { type: "string", description: "Stable product id, used in /api/compare and calculator links.", examples: ["charmin-ultra-soft-mega"] },
      brand: { type: "string", examples: ["charmin"] },
      brandName: { type: "string" },
      name: { type: "string", description: "Line and size, without the brand." },
      fullName: { type: "string" },
      line: { type: "string" },
      size: { type: ["string", "null"], description: "The brand's size name. Null when the brand has none (Kirkland Signature).", examples: ["Mega", "Mega XL", "Super Mega"] },
      isRegularRoll: { type: "boolean", description: "The brand's regular roll, the yardstick for its \"= N regular\" claims. Not a pack you can compare." },
      sheetsPerRoll: { type: "integer" },
      sheetWidthIn: { type: "number" },
      sheetLengthIn: { type: "number" },
      sqFtPerRoll: { type: "number" },
      ply: { type: "integer" },
      regularRolls: { type: ["number", "null"], description: "What the pack says one roll equals in regular rolls. Null when the brand makes no such claim." },
      regularRollSheets: { type: ["integer", "null"], description: "Sheets on this brand's regular roll. Null when the brand has none." },
      honestRolls: { type: "number", description: `Square feet per roll ÷ ${D.honestRollSqFt}.` },
      printedTotal: { type: ["object", "null"], properties: { sqFt: { type: "number" }, rolls: { type: "integer" } } },
      estimated: { type: "object", properties: { sheets: { type: ["string", "null"] }, size: { type: ["string", "null"] } } },
      note: { type: "string" },
      source: { type: "string" },
      sourceUrl: { type: ["string", "null"], format: "uri" },
      sources: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: ["string", "null"] } } } },
      softness: {
        type: ["object", "null"],
        description: `Softness score for the product's line, 0 to ${S.max}. Null when not rated (no good source, a regular roll, or a custom roll). Method: ${ORIGIN}/softness`,
        properties: {
          score: { type: "integer", minimum: 0, maximum: S.max },
          outOf: { type: "integer", const: S.max },
          line: { type: "string" },
          basis: { type: "string", description: "Why the line has this score." },
          sources: { type: "array", items: { type: "object", properties: { publisher: { type: "string" }, title: { type: "string" }, url: { type: "string", format: "uri" }, date: { type: "string", description: "As precise as the source gives." }, dateKind: { type: "string", enum: ["updated", "published", "tested", "checked"], description: "What the date is: when the page was last updated or published, when the test ran, or when we checked an undated maker page." }, method: { type: "string" } } } },
        },
      },
      converterUrl: { type: "string", format: "uri" },
    },
  };
  const examplePacks = Core.defaultDeal().packs.map((p) => `${p.productId},${p.rolls},${p.price}`);
  const packParams = Core.PARAMS.split("").map((letter, i) => ({
    name: letter, in: "query", required: i < 2,
    description: `Pack ${letter.toUpperCase()}: <product id>,<rolls>,<price>. A custom roll is custom:<sheets>:<width>x<length>:<ply>.`,
    schema: { type: "string" },
    ...(i < 2 ? { example: examplePacks[i] } : {}),
  }));
  const error = { type: "object", required: ["error"], properties: { error: { type: "string" }, problems: { type: "array", items: { type: "object", properties: { param: { type: "string" }, message: { type: "string" } } } } } };
  const openapi = {
    openapi: "3.1.0",
    info: {
      title: `${SITE_NAME} API`,
      version: UPDATED,
      description: `Read-only data about ${site.brandList} toilet paper rolls, and a price comparison. Free to use; please link to ${ORIGIN}.`,
    },
    servers: [{ url: ORIGIN }],
    externalDocs: { description: "Data & API", url: `${ORIGIN}/data` },
    paths: {
      "/api/products": {
        get: {
          operationId: "listProducts",
          summary: "Every brand and roll",
          responses: {
            200: {
              description: "Brands and rolls. Cached for an hour, with an ETag.",
              content: { "application/json": { schema: {
                type: "object",
                properties: {
                  checked: { type: "string" },
                  honestRollSqFt: { type: "number" },
                  softness: { type: "object", properties: { checked: { type: "string" }, outOf: { type: "integer" }, method: { type: "array", items: { type: "string" } }, about: { type: "string", format: "uri" } } },
                  brands: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, maker: { type: "string" }, regularRollId: { type: ["string", "null"] }, regularRollSheets: { type: ["integer", "null"] } } } },
                  products: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                },
              } } },
            },
          },
        },
      },
      "/api/compare": {
        get: {
          operationId: "comparePacks",
          summary: "Compare 2 to 8 packs by price, softness or a balance of both",
          parameters: [
            { name: "mode", in: "query", required: false, description: "sheets: per sheet (default). area: per square foot. areaply: per square foot × ply.", schema: { type: "string", enum: Core.MODE_KEYS, default: Core.DEFAULT_MODE } },
            { name: "p", in: "query", required: false, description: `What matters more. cheap: lowest price per unit (default). balanced: a softer pack wins if it costs at most ${Core.pct(Core.BALANCE_STEP)} more per unit for each softness point it gains over the cheapest pack. soft: the softest rated pack wins, price breaks ties. Packs that aren't rated can't win on softness.`, schema: { type: "string", enum: Core.PRIORITY_KEYS, default: Core.DEFAULT_PRIORITY } },
            ...packParams,
          ],
          responses: {
            200: {
              description: "Costs per pack and the winner. Cached for 5 minutes.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Comparison" } } },
            },
            400: { description: "A parameter is missing or invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        Product: productSchema,
        Error: error,
        Comparison: {
          type: "object",
          properties: {
            mode: { type: "string", enum: Core.MODE_KEYS },
            modeName: { type: "string" },
            priority: { type: "string", enum: Core.PRIORITY_KEYS },
            priorityName: { type: "string" },
            pickReason: { type: ["string", "null"], enum: ["cheap", "none-rated", "cheapest-unrated", "balanced-cheap", "balanced-soft", "soft", null], description: "Why the winner won. none-rated and cheapest-unrated mean softness couldn't be weighed, so the cheapest won." },
            packs: { type: "array", items: { type: "object", properties: {
              pack: { type: "string" }, label: { type: "string" }, productId: { type: "string" }, name: { type: "string" },
              sheetsPerRoll: { type: "number" }, sheetWidthIn: { type: "number" }, sheetLengthIn: { type: "number" }, ply: { type: "number" },
              rolls: { type: "integer" }, price: { type: "number" }, totalSheets: { type: "number" }, totalSqFt: { type: "number" },
              pricePer100Sheets: { type: "number" }, pricePerSqFt: { type: "number" }, pricePerSqFtPly: { type: "number" },
              softness: { type: ["integer", "null"], description: `Softness score, 0 to ${S.max}, or null when not rated.` },
              best: { type: "boolean", description: "This pack wins for the priority p." },
              cheapest: { type: "boolean", description: "This pack is the cheapest per unit (within 0.5%)." },
              percentMoreThanBest: { type: "number", description: "Percent more per unit than the cheapest pack." },
            } } },
            winner: { type: ["string", "null"], description: "The winning pack's letter for the priority p, or null on a tie." },
            tie: { type: ["array", "null"], items: { type: "string" } },
            percentCheaperThanPriciest: { type: "number" },
            summary: { type: "string" },
            link: { type: "string", format: "uri", description: "The same comparison in the calculator." },
          },
        },
      },
    },
  };

  const manifest = {
    name: SITE_NAME,
    short_name: "TP Math",
    description: site.siteDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFF8EC",
    theme_color: "#FFF8EC",
    icons: [
      { src: assetUrl("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: assetUrl("/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: assetUrl("/icon.svg"), sizes: "any", type: "image/svg+xml" },
    ],
  };

  const json = (v) => JSON.stringify(v, null, 2) + "\n";
  return [
    { path: "/robots.txt", text: robots },
    { path: "/sitemap.xml", text: sitemap },
    { path: "/llms.txt", text: llms },
    { path: "/llms-full.txt", text: llmsFull },
    { path: "/openapi.json", text: json(openapi) },
    { path: "/site.webmanifest", text: json(manifest) },
    { path: "/api/products", text: json(Core.productsJSON()), type: "application/json; charset=utf-8" },
    { path: `/${INDEXNOW_KEY}.txt`, text: INDEXNOW_KEY },
  ];
}
