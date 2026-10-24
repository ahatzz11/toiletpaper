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
- \`a\` to \`h\`: up to ${Core.MAX_PACKS} packs. Each is a product id from /api/products, the number of rolls and the price in dollars. The price may be left empty.
- A roll that isn't listed: \`custom:<sheets>:<width>x<length>:<ply>\`, with sheet sides in inches, for example \`custom:300:4x4:2,12,15.99\`.
- Example: ${exampleLink}

The roll converter takes \`${ORIGIN}/convert?roll=<product id>&mode=<mode>\`, for example ${ORIGIN}/convert?roll=quilted-northern-ultra-plush-mega&mode=area.

Bad or unknown values are ignored and the page falls back to its defaults.`;

  const api = `## Data and API

Read-only JSON, free to use with a link back. CORS is open.

- [${ORIGIN}/api/products](${ORIGIN}/api/products): every brand and roll with sheets per roll, sheet size, square feet, ply, what it equals in regular rolls, and its source.
- [${ORIGIN}/api/compare](${compareExample}): \`GET /api/compare?mode=sheets&a=<id>,<rolls>,<price>&b=...\` (2 to ${Core.MAX_PACKS} packs) returns the cost per 100 sheets, per square foot and per square foot × ply for each pack, the winner, the percent difference and a link to the same comparison in the calculator.
- [${ORIGIN}/openapi.json](${ORIGIN}/openapi.json): OpenAPI 3.1 description of both endpoints.
- [${ORIGIN}/data](${ORIGIN}/data): the same docs for people, with the full roll table and a source for every number.`;

  const llms = `# ${SITE_NAME}

> Free calculators for comparing ${site.brandList} toilet paper packs by price per sheet and per square foot, and for decoding roll names like Mega, Mega XL and Super Mega. Each brand's "= N regular rolls" claim uses its own regular roll (${brands.map((b) => `${b.name} ${b.regular.sheets} sheets`).join(", ")}), so the site compares actual sheets and paper area instead. Sheet counts come from pack labels, checked ${D.checked}.

## Tools

${tools.map(pageLine).join("\n")}

## Guides

${guides.map(pageLine).join("\n")}
${pageLine(about)}

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
      return `| ${md(Core.fullName(p))} | ${p.id} | ${p.sheets}${p.flags.sheets ? ` (${p.flags.sheets})` : ""} | ${p.width} × ${p.length}${p.flags.size ? ` (${p.flags.size})` : ""} | ${p.ply} | ${Core.fix(Core.sqFtOf(p), 2)} | ${p.isRegular ? "regular roll" : `= ${p.claim} regular`} | ${Core.fix(p.sheets / reg.sheets, 2)} | ${src ? src.url : md(p.source)} |`;
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
      size: { type: "string", examples: ["Mega", "Mega XL", "Super Mega"] },
      isRegularRoll: { type: "boolean", description: "The brand's regular roll, the yardstick for its \"= N regular\" claims. Not a pack you can compare." },
      sheetsPerRoll: { type: "integer" },
      sheetWidthIn: { type: "number" },
      sheetLengthIn: { type: "number" },
      sqFtPerRoll: { type: "number" },
      ply: { type: "integer" },
      regularRolls: { type: "number", description: "What the pack says one roll equals in regular rolls." },
      regularRollSheets: { type: "integer", description: "Sheets on this brand's regular roll." },
      honestRolls: { type: "number", description: `Square feet per roll ÷ ${D.honestRollSqFt}.` },
      printedTotal: { type: ["object", "null"], properties: { sqFt: { type: "number" }, rolls: { type: "integer" } } },
      estimated: { type: "object", properties: { sheets: { type: ["string", "null"] }, size: { type: ["string", "null"] } } },
      note: { type: "string" },
      source: { type: "string" },
      sourceUrl: { type: ["string", "null"], format: "uri" },
      sources: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: ["string", "null"] } } } },
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
                  brands: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, maker: { type: "string" }, regularRollId: { type: "string" }, regularRollSheets: { type: "integer" } } } },
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
          summary: "Compare 2 to 8 packs by price",
          parameters: [
            { name: "mode", in: "query", required: false, description: "sheets: per sheet (default). area: per square foot. areaply: per square foot × ply.", schema: { type: "string", enum: Core.MODE_KEYS, default: Core.DEFAULT_MODE } },
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
            packs: { type: "array", items: { type: "object", properties: {
              pack: { type: "string" }, label: { type: "string" }, productId: { type: "string" }, name: { type: "string" },
              sheetsPerRoll: { type: "number" }, sheetWidthIn: { type: "number" }, sheetLengthIn: { type: "number" }, ply: { type: "number" },
              rolls: { type: "integer" }, price: { type: "number" }, totalSheets: { type: "number" }, totalSqFt: { type: "number" },
              pricePer100Sheets: { type: "number" }, pricePerSqFt: { type: "number" }, pricePerSqFtPly: { type: "number" },
              best: { type: "boolean" }, percentMoreThanBest: { type: "number" },
            } } },
            winner: { type: ["string", "null"], description: "The cheapest pack's letter, or null on a tie." },
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
