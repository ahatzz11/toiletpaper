// The page shell: <head> with every meta tag, the header and nav, the footer, and JSON-LD.
// Every HTML page on the site goes through renderPage, so they can't drift apart.

import { ORIGIN, SITE_NAME, SHARE } from "./config.mjs";

const NAV = [
  { key: "deal", path: "/", label: "Best deal", short: "Deal" },
  { key: "convert", path: "/convert", label: "Roll converter", short: "Converter" },
  { key: "about", path: "/about", label: "How it works" },
  { key: "data", path: "/data", label: "Data" },
];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const abs = (path) => ORIGIN + path;

// Marks the server-rendered tool so the Worker can swap in a deep-linked version.
export const TOOL_START = "<!--tool-->";
export const TOOL_END = "<!--/tool-->";

function jsonLd(page, ctx) {
  const url = abs(page.path);
  const graph = [{
    "@type": "WebSite",
    "@id": ORIGIN + "/#website",
    url: ORIGIN + "/",
    name: SITE_NAME,
    description: ctx.siteDescription,
    inLanguage: "en-US",
  }];
  if (page.app) {
    graph.push({
      "@type": "WebApplication",
      "@id": url + "#app",
      name: page.app,
      url,
      description: page.description,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Works in any modern browser. JavaScript adds live updates.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      isPartOf: { "@id": ORIGIN + "/#website" },
    });
  }
  if (page.crumbs?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "Home", path: "/" }, ...page.crumbs].map((c, i) => ({
        "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path),
      })),
    });
  }
  if (page.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: page.faq.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.text } })),
    });
  }
  // "<" is escaped so the JSON can never close the script tag early.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

function crumbsHTML(page) {
  if (!page.showCrumbs || !page.crumbs?.length) return "";
  const items = [{ name: "Home", path: "/" }, ...page.crumbs];
  return '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + items.map((c, i) =>
    i === items.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.path}">${esc(c.name)}</a></li>`,
  ).join("") + "</ol></nav>";
}

export function renderPage(page, ctx) {
  const url = abs(page.path);
  const image = abs(SHARE.image);
  const video = abs(SHARE.video);
  const meta = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${esc(page.ogTitle ?? page.title.replace(/ \| Toilet Paper Math$/, ""))}">`,
    `<meta property="og:description" content="${esc(page.ogDescription ?? page.description)}">`,
    page.noindex ? "" : `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="${SHARE.width}">`,
    `<meta property="og:image:height" content="${SHARE.height}">`,
    `<meta property="og:image:alt" content="${esc(SHARE.imageAlt)}">`,
    `<meta property="og:video" content="${video}">`,
    `<meta property="og:video:secure_url" content="${video}">`,
    `<meta property="og:video:type" content="video/mp4">`,
    `<meta property="og:video:width" content="${SHARE.width}">`,
    `<meta property="og:video:height" content="${SHARE.height}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${esc(SHARE.imageAlt)}">`,
    `<meta name="theme-color" content="#FFF8EC">`,
    `<link rel="icon" href="/favicon.ico" sizes="32x32">`,
    `<link rel="icon" href="/icon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
  ].filter(Boolean).map((l) => "  " + l).join("\n");

  const nav = NAV.map((n) => `        <a href="${n.path}"${n.key === page.nav ? ' aria-current="page"' : ""}>${n.short ? `<span class="nav-long">${n.label}</span><span class="nav-short">${n.short}</span>` : n.label}</a>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${meta}
  <style>
    /* Fallback header layout, so the header stays small even if styles.css fails to load.
       :where() keeps these at zero specificity, so styles.css always wins. Keep in sync with it. */
    :where(.skip-link) { position: absolute; left: 12px; top: -60px; }
    :where(.skip-link:focus) { top: 12px; }
    :where(.wrap) { width: min(1200px, 100% - 32px); margin-inline: auto; }
    :where(.header-inner) { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; padding: 10px 0; }
    :where(.brand) { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    :where(.mascot) { width: 58px; height: 63px; flex: none; }
    :where(.brand-text) { display: flex; flex-direction: column; line-height: 1.15; }
    :where(.site-nav) { display: flex; flex-wrap: wrap; gap: 4px 16px; }
    :where(.nav-short) { display: none; }
    @media (max-width: 640px) { :where(.mascot) { width: 40px; height: 44px; } }
  </style>
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${jsonLd(page, ctx)}</script>
</head>
<body data-page="${page.key}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="sky" id="sky" aria-hidden="true"></div>

  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/" aria-label="${SITE_NAME} home">
        <svg class="mascot" width="58" height="63" viewBox="60 40 240 260" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="tail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="400">
              <path class="tail-reveal" d="M150 150 C 150 230, 60 230, 80 300 S 220 360, 250 390" fill="none" stroke="#fff" stroke-width="90" pathLength="100" />
            </mask>
          </defs>
          <g mask="url(#tail-mask)">
            <path d="M150 150 C 150 230, 60 230, 80 300 S 220 360, 250 390" fill="none" stroke="#E4D3BC" stroke-width="66" />
            <path d="M150 150 C 150 230, 60 230, 80 300 S 220 360, 250 390" fill="none" stroke="#FFFFFF" stroke-width="60" />
            <path d="M150 150 C 150 230, 60 230, 80 300 S 220 360, 250 390" fill="none" stroke="#D9C6AE" stroke-width="60" stroke-dasharray="1.5 34" />
          </g>
          <g class="roll-body">
            <rect x="90" y="60" width="150" height="120" rx="6" fill="#FFFFFF" stroke="#2E2140" stroke-width="7" />
            <ellipse cx="240" cy="120" rx="34" ry="60" fill="#FFFDF8" stroke="#2E2140" stroke-width="7" />
            <ellipse cx="240" cy="120" rx="12" ry="22" fill="#C99A63" stroke="#2E2140" stroke-width="6" />
            <circle cx="130" cy="112" r="7" fill="#2E2140" />
            <circle cx="180" cy="112" r="7" fill="#2E2140" />
            <ellipse cx="114" cy="134" rx="11" ry="7" fill="#FFB3C7" />
            <ellipse cx="196" cy="134" rx="11" ry="7" fill="#FFB3C7" />
            <path d="M140 132 Q 155 148 170 132" fill="none" stroke="#2E2140" stroke-width="6" stroke-linecap="round" />
            <rect x="120" y="176" width="60" height="10" fill="#FFFFFF" />
          </g>
        </svg>
        <span class="brand-text">
          <span class="brand-name">${SITE_NAME}</span>
          <span class="brand-tag">Mega, Mega XL, Super Mega, decoded</span>
        </span>
      </a>
      <nav class="site-nav" aria-label="Main">
${nav}
      </nav>
    </div>
  </header>

  <main id="main" class="wrap page${page.mainClass ? " " + page.mainClass : ""}">
    ${crumbsHTML(page)}${page.body}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-line">Not affiliated with any brand</p>
    </div>
  </footer>

  <script src="/data.js"></script>
  <script src="/core.js"></script>
  <script src="/app.js"></script>
</body>
</html>
`;
}
