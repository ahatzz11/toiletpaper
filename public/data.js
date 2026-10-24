// Toilet Paper Math data. The one source for every number on the site: the browser loads this
// file as /data.js, the Worker inlines it for the API and server-rendered pages, and the build
// reads it for the tables, sitemap and llms.txt.
//
// Product ids are public and stable: they appear in deep links and the API. Don't rename them.
// Every number below comes from packaging text, checked October 2026. Nothing here is invented.
// Manufacturer numbers beat retailer listings: when the maker's own site or pack photo gives a
// number, that's the value used and the first entry in `sources`. Retailer listings are a
// fallback for numbers the maker doesn't publish, and the product's `source` note says so.
//
// flags.sheets / flags.size:
//   "derived"   = computed from other printed numbers (usually total sq ft)
//   "estimated" = not found printed anywhere, assumed from a sibling product
//
// printedTotal = the total square footage printed on the pack, when we had one.
// It lets the sources table show our math next to the printed number.

var TP_DATA = {
  checked: "October 2026",
  honestRollSqFt: 6,

  // regularId: the roll each brand's "= N regular rolls" claim counts in.
  brands: {
    charmin: { slug: "charmin", name: "Charmin", short: "Charmin", maker: "Procter & Gamble", regularId: "charmin-regular" },
    qn: { slug: "quilted-northern", name: "Quilted Northern", short: "QN", maker: "Georgia-Pacific", regularId: "quilted-northern-regular" },
    angel: { slug: "angel-soft", name: "Angel Soft", short: "Angel Soft", maker: "Georgia-Pacific", regularId: "angel-soft-regular" },
    // Kirkland prints no "= N regular rolls" claim, so it has no regular roll: its own roll is
    // the unit, and the converter measures it in the other brands' regular rolls.
    kirkland: { slug: "kirkland-signature", name: "Kirkland Signature", short: "Kirkland", maker: "Costco", regularId: null },
  },

  products: [
    // ---------- Charmin ----------
    {
      id: "charmin-ultra-soft-mega",
      brand: "charmin",
      line: "Ultra Soft", size: "Mega",
      soft: "charmin-ultra-soft",
      name: "Ultra Soft Mega",
      sheets: 208, width: 4, length: 3.92, ply: 2,
      claim: 4,
      defaultRolls: 6,
      printedTotal: { sqft: 135, rolls: 6 },
      note: "Older packs listed 244 sheets. Same name, same \"= 4 regular\" promise.",
      source: "charmin.com for the claim; Hannaford packaging text for sheets, sheet size and pack total. P&G SmartLabel still lists 224 sheets, but those records were last updated in 2022. Current packs at retailers print the count above, and Quilted Northern's site compares against a 208-sheet leading-brand Mega.",
      sources: [
        { name: "charmin.com (claim)", url: "https://www.charmin.com/en-us/shop-products/ultra-soft-toilet-paper" },
        { name: "Hannaford (sheets, size, pack total)", url: "https://hannaford.com/groceries/product/charmin-ultra-soft-mega-roll-2-ply-toilet-paper-unscented-6-ct-135-sq-ft/386286" },
        { name: "P&G SmartLabel (lists 224, last updated 2022)", url: "https://smartlabel.pg.com/en-us/00030772088081.html" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-soft-mega-xl",
      brand: "charmin",
      line: "Ultra Soft", size: "Mega XL",
      soft: "charmin-ultra-soft",
      name: "Ultra Soft Mega XL",
      sheets: 312, width: 4, length: 3.92, ply: 2,
      claim: 6,
      defaultRolls: 6,
      printedTotal: { sqft: 203, rolls: 6 },
      note: "Formerly called \"Super Mega\". 50% more sheets than Mega.",
      source: "charmin.com for the claim; Hannaford packaging text for sheets, sheet size and pack total. P&G SmartLabel still lists 336 sheets, but those records were last updated in 2022. Current packs at retailers print the count above, and Quilted Northern's site compares against a 208-sheet leading-brand Mega.",
      sources: [
        { name: "charmin.com (claim)", url: "https://www.charmin.com/en-us/shop-products/ultra-soft-toilet-paper-super-mega-roll" },
        { name: "Hannaford (sheets, size, pack total)", url: "https://hannaford.com/groceries/product/charmin-ultra-soft-mega-xl-roll-2-ply-toilet-paper-unscented-6-ct-203-sq-ft/386290" },
        { name: "P&G SmartLabel (lists 336, last updated 2022)", url: "https://smartlabel.pg.com/en-us/00030772084670.html" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-soft-mega-xxl",
      brand: "charmin",
      line: "Ultra Soft", size: "Mega XXL",
      soft: "charmin-ultra-soft",
      name: "Ultra Soft Mega XXL",
      sheets: 416, width: 4.27, length: 3.72, ply: 2,
      claim: 8,
      defaultRolls: 12,
      printedTotal: { sqft: 550, rolls: 12 },
      note: "Different sheet shape: wider and shorter than Mega and Mega XL.",
      source: "charmin.com for the claim; Giant packaging text for sheets, sheet size and pack total. P&G SmartLabel still lists 440 sheets, but those records were last updated in 2022. Current packs at retailers print the count above, and Quilted Northern's site compares against a 208-sheet leading-brand Mega (416 is 2 of those).",
      sources: [
        { name: "charmin.com (claim)", url: "https://www.charmin.com/en-us/shop-products/ultra-soft-toilet-paper-mega-xxl-roll" },
        { name: "Giant (sheets, size, pack total)", url: "https://giantfoodstores.com/groceries/product/charmin-ultra-soft-mega-xxl-roll-2-ply-toilet-paper-unscented-12-ct-550-sq-ft/386294" },
        { name: "P&G SmartLabel (lists 440, last updated 2022)", url: "https://smartlabel.pg.com/en-us/00030772135693.html" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-strong-mega",
      brand: "charmin",
      line: "Ultra Strong", size: "Mega",
      soft: "charmin-ultra-strong",
      name: "Ultra Strong Mega",
      sheets: 220, width: 4, length: 3.92, ply: 2,
      claim: 4,
      defaultRolls: 6,
      printedTotal: { sqft: 143, rolls: 6 },
      note: "Twelve more sheets than Ultra Soft Mega, same \"= 4 regular\" claim. Target's listing shows 198 sheets, so a smaller roll may be rolling out.",
      source: "P&G SmartLabel for sheets and claim; Hannaford for sheet size and pack total.",
      sources: [
        { name: "P&G SmartLabel (sheets, claim)", url: "https://smartlabel.pg.com/en-us/00030772111062.html" },
        { name: "Hannaford (size, pack total)", url: "https://hannaford.com/groceries/product/charmin-ultra-strong-mega-roll-2-ply-toilet-paper-unscented-6-ct-143-sq-ft/366862" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-strong-mega-xl",
      brand: "charmin",
      line: "Ultra Strong", size: "Mega XL",
      soft: "charmin-ultra-strong",
      name: "Ultra Strong Mega XL",
      sheets: 330, width: 4, length: 3.92, ply: 2,
      claim: 6,
      defaultRolls: 8,
      printedTotal: { sqft: 287, rolls: 8 },
      note: "Replaced Super Mega. Target's listing shows 297 sheets, so a smaller roll may be rolling out.",
      source: "charmin.com and P&G SmartLabel for sheets, claim and ply; Hannaford for sheet size and pack total.",
      sources: [
        { name: "charmin.com (sheets, claim, ply)", url: "https://www.charmin.com/en-us/shop-products/ultra-strong-toilet-paper-mega-xl-roll" },
        { name: "P&G SmartLabel", url: "https://smartlabel.pg.com/en-us/00030772134535.html" },
        { name: "Hannaford (size, pack total)", url: "https://hannaford.com/groceries/product/charmin-ultra-strong-mega-xl-roll-2-ply-toilet-paper-unscented-8-ct-287-sq-ft/371560" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-strong-mega-xxl",
      brand: "charmin",
      line: "Ultra Strong", size: "Mega XXL",
      soft: "charmin-ultra-strong",
      name: "Ultra Strong Mega XXL",
      sheets: 440, width: 4.27, length: 3.72, ply: 2,
      claim: 8,
      defaultRolls: 12,
      printedTotal: { sqft: 582, rolls: 12 },
      note: "charmin.com's size table: Regular = 1, Mega = 4, Mega XL = 6, Mega XXL = 8. Target's specs show 396 sheets.",
      source: "charmin.com and P&G SmartLabel for sheets and claim; Hannaford and Target for sheet size and pack total.",
      sources: [
        { name: "charmin.com (sheets, claim)", url: "https://www.charmin.com/en-us/shop-products/ultra-strong-toilet-paper-mega-xxl-roll" },
        { name: "P&G SmartLabel", url: "https://smartlabel.pg.com/en-us/00030772135716.html" },
        { name: "Hannaford (size, pack total)", url: "https://hannaford.com/groceries/product/charmin-ultra-strong-mega-xxl-roll-2-ply-toilet-paper-unscented-12-ct-582-sq-ft/371766" },
        { name: "Target", url: "https://www.target.com/p/charmin-ultra-strong-toilet-paper-12-mega-xxl-rolls/-/A-91778080" },
      ],
      flags: {},
    },
    {
      id: "charmin-ultra-strong-super-mega-older",
      brand: "charmin",
      line: "Ultra Strong", size: "Super Mega",
      soft: "charmin-ultra-strong",
      name: "Ultra Strong Super Mega (older pack)",
      sheets: 363, width: 4, length: 3.92, ply: 2,
      claim: 6,
      defaultRolls: 6,
      note: "The older name and the older, higher sheet count.",
      source: "Quill",
      sources: [
        { name: "Quill (discontinued listing)", url: "https://www.quill.com/charmin-ultra-strong-super-mega-toilet-paper-2-ply-white-363-sheets-roll-12-rolls-pack-04311/cbs/55451780.html" },
      ],
      flags: {},
    },
    {
      id: "charmin-essentials-mega",
      brand: "charmin",
      line: "Essentials", size: "Mega",
      soft: "charmin-essentials",
      name: "Essentials Mega (1-ply)",
      sheets: 407, width: 4, length: 3.92, ply: 1,
      claim: 4,
      defaultRolls: 12,
      printedTotal: { sqft: 531, rolls: 12 },
      note: "1-ply line that replaced Essentials Soft and Essentials Strong. Sheet size taken from Essentials Strong packs.",
      source: "charmin.com for sheets, claim and ply; Walmart for the pack total.",
      sources: [
        { name: "charmin.com (sheets)", url: "https://www.charmin.com/en-us/tips-and-articles/new-charmin-essentials" },
        { name: "charmin.com (claim, ply)", url: "https://www.charmin.com/en-us/shop-products/essentials-toilet-paper" },
        { name: "Walmart (pack total)", url: "https://www.walmart.com/ip/CHRM-ESS-4-12MR-407CT-PDQ-US/20564273875" },
      ],
      flags: { size: "derived" },
    },
    {
      id: "charmin-regular",
      brand: "charmin",
      line: null, size: "Regular",
      name: "Regular roll",
      sheets: 52, width: 4, length: 3.92, ply: 2,
      claim: 1,
      isRegular: true,
      note: "Never printed anywhere. 208 Mega sheets divided by its \"= 4 regular\" claim gives 52.",
      source: "Derived from Ultra Soft Mega (208 / 4)",
      sources: [],
      flags: { sheets: "derived" },
    },
    // ---------- Quilted Northern ----------
    {
      id: "quilted-northern-ultra-plush-mega",
      brand: "qn",
      line: "Ultra Plush", size: "Mega",
      soft: "qn-ultra-plush",
      name: "Ultra Plush Mega",
      sheets: 255, width: 4, length: 3.8, ply: 3,
      claim: 4,
      defaultRolls: 6,
      printedTotal: { sqft: 161.5, rolls: 6 },
      note: "Pack footnote: compared to a regular roll with 63 sheets.",
      source: "quiltednorthern.com for sheets, ply and claim; Stop & Shop for sheet size and pack total.",
      sources: [
        { name: "quiltednorthern.com (sheets, ply)", url: "https://www.quiltednorthern.com/products/quilted-northern-ultra-plush" },
        { name: "quiltednorthern.com FAQ (claim)", url: "https://www.quiltednorthern.com/faq" },
        { name: "Stop & Shop (size, pack total)", url: "https://stopandshop.com/groceries/product/quilted-northern-ultra-plush-mega-roll-3-ply-toilet-paper-unscented-6-ct-161-5-sq-ft/232271" },
      ],
      flags: {},
    },
    {
      id: "quilted-northern-ultra-plush-super-mega",
      brand: "qn",
      line: "Ultra Plush", size: "Super Mega",
      soft: "qn-ultra-plush",
      name: "Ultra Plush Super Mega",
      sheets: 378, width: 3.7, length: 4.1, ply: 3,
      claim: 6,
      defaultRolls: 8,
      printedTotal: { sqft: 318.5, rolls: 8 },
      note: "QN's FAQ says Super Mega sheets are 0.3 in shorter and 0.3 in wider than Mega.",
      source: "quiltednorthern.com FAQ for the claim and how the sheet differs from Mega; Kroger for sheets and pack total.",
      sources: [
        { name: "quiltednorthern.com FAQ (claim, sheet shape)", url: "https://www.quiltednorthern.com/faq" },
        { name: "Kroger (sheets, pack total)", url: "https://www.kroger.com/p/quilted-northern-ultra-plush-toilet-paper-super-mega-rolls/0004200087653" },
      ],
      flags: { size: "derived" },
    },
    {
      id: "quilted-northern-ultra-soft-strong-mega",
      brand: "qn",
      line: "Ultra Soft & Strong", size: "Mega",
      soft: "qn-ultra-soft-strong",
      name: "Ultra Soft & Strong Mega",
      sheets: 255, width: 4, length: 3.8, ply: 2,
      claim: 4,
      defaultRolls: 12,
      printedTotal: { sqft: 161.5, rolls: 6 },
      note: "QN brags 255 sheets vs the \"leading brand\" Mega at 208. Older packs had 328.",
      source: "quiltednorthern.com for sheets, ply and claim; Hannaford for sheet size and pack total.",
      sources: [
        { name: "quiltednorthern.com (sheets, ply)", url: "https://www.quiltednorthern.com/products/quilted-northern-ultra-soft-and-strong" },
        { name: "quiltednorthern.com FAQ (claim)", url: "https://www.quiltednorthern.com/faq" },
        { name: "Hannaford (size, pack total)", url: "https://hannaford.com/groceries/product/quilted-northern-ultra-soft-strong-mega-rolls-2-ply-toilet-paper-6-ct-161-5-sq-ft/402443" },
      ],
      flags: {},
    },
    {
      id: "quilted-northern-ultra-soft-strong-super-mega-378",
      brand: "qn",
      line: "Ultra Soft & Strong", size: "Super Mega",
      soft: "qn-ultra-soft-strong",
      name: "Ultra Soft & Strong Super Mega (378 sheets)",
      sheets: 378, width: 3.7, length: 4.1, ply: 2,
      claim: 6,
      defaultRolls: 8,
      printedTotal: { sqft: 318.5, rolls: 8 },
      note: "Sold under the same name as the 438-sheet roll.",
      source: "quiltednorthern.com FAQ for the claim; Hannaford for sheets, sheet size and pack total.",
      sources: [
        { name: "quiltednorthern.com FAQ (claim)", url: "https://www.quiltednorthern.com/faq" },
        { name: "Hannaford (sheets, size, pack total)", url: "https://hannaford.com/groceries/product/quilted-northern-ultra-soft-strong-mega-roll-2-ply-toilet-paper-8-ct-318-5-sq-ft/406330" },
      ],
      flags: {},
    },
    {
      id: "quilted-northern-ultra-soft-strong-super-mega-438",
      brand: "qn",
      line: "Ultra Soft & Strong", size: "Super Mega",
      soft: "qn-ultra-soft-strong",
      name: "Ultra Soft & Strong Super Mega (438 sheets)",
      sheets: 438, width: 3.7, length: 4.1, ply: 2,
      claim: 6,
      defaultRolls: 8,
      printedTotal: { sqft: 369.1, rolls: 8 },
      note: "Same name, more sheets, still says \"= 6 regular\".",
      source: "quiltednorthern.com FAQ for the claim; Kroger for sheets and pack total.",
      sources: [
        { name: "quiltednorthern.com FAQ (claim)", url: "https://www.quiltednorthern.com/faq" },
        { name: "Kroger (sheets, pack total)", url: "https://www.kroger.com/p/quilted-northern-ultra-plush-toilet-paper-super-soft-strong-mega-rolls/0004200094649" },
      ],
      flags: { size: "derived" },
    },
    {
      id: "quilted-northern-regular",
      brand: "qn",
      line: null, size: "Regular",
      name: "Regular roll",
      sheets: 63, width: 4, length: 3.8, ply: 3,
      claim: 1,
      isRegular: true,
      note: "63 sheets is printed in the Ultra Plush pack footnote. Sheet size assumed to match Mega, 3-ply on the Ultra Plush basis.",
      source: "Quilted Northern Ultra Plush pack footnote",
      sources: [
        { name: "Stop & Shop (pack footnote)", url: "https://stopandshop.com/groceries/product/quilted-northern-ultra-plush-mega-roll-3-ply-toilet-paper-unscented-6-ct-161-5-sq-ft/232271" },
      ],
      flags: { size: "estimated" },
    },
    // ---------- Angel Soft ----------
    {
      id: "angel-soft-mega",
      brand: "angel",
      line: "Angel Soft", size: "Mega",
      soft: "angel-soft",
      name: "Mega",
      sheets: 320, width: 3.8, length: 4, ply: 2,
      claim: 4,
      defaultRolls: 12,
      printedTotal: { sqft: 405.3, rolls: 12 },
      note: "Older listings showed 429 or more sheets. Georgia-Pacific says it cut sheet counts to make the paper thicker.",
      source: "angelsoft.com for sheets, claim and ply; Giant and Hannaford for sheet size and pack totals.",
      sources: [
        { name: "angelsoft.com (sheets, claim, ply)", url: "https://www.angelsoft.com/products/angel-soft-toilet-paper" },
        { name: "Giant (size, pack total)", url: "https://giantfood.com/groceries/product/angel-soft-mega-roll-2-ply-toilet-paper-unscented-12-ct-405-3-sq-ft/330319" },
        { name: "Hannaford", url: "https://hannaford.com/groceries/product/angel-soft-mega-roll-2-ply-toilet-paper-unscented-16-ct-540-4-sq-ft/328565" },
      ],
      flags: {},
    },
    {
      id: "angel-soft-mega-xl",
      brand: "angel",
      line: "Angel Soft", size: "Mega XL",
      soft: "angel-soft",
      name: "Mega XL",
      sheets: 480, width: 3.8, length: 4, ply: 2,
      claim: 6,
      defaultRolls: 8,
      printedTotal: { sqft: 405.3, rolls: 8 },
      note: "Some grocers sell it as \"Super Mega\". Same 480 sheets either way.",
      source: "angelsoft.com for the claim and ply; Giant and Food Lion for sheets, sheet size and pack total.",
      sources: [
        { name: "angelsoft.com (claim, ply)", url: "https://www.angelsoft.com/products/angel-soft-toilet-paper" },
        { name: "Giant (sheets, size, pack total)", url: "https://giantfood.com/groceries/product/angel-soft-super-mega-roll-2-ply-toilet-paper-unscented-8-ct-405-3-sq-ft/371668" },
        { name: "Food Lion", url: "https://foodlion.com/groceries/product/angel-soft-super-mega-roll-2-ply-toilet-paper-unscented-8-ct-405-3-sq-ft/371668" },
      ],
      flags: {},
    },
    {
      id: "angel-soft-regular",
      brand: "angel",
      line: null, size: "Regular",
      name: "Regular roll",
      sheets: 80, width: 3.8, length: 4, ply: 2,
      claim: 1,
      isRegular: true,
      note: "Never printed. 320 Mega sheets divided by \"= 4 regular\" and 480 Mega XL sheets divided by \"= 6 regular\" both give 80. Sheet size assumed to match Mega.",
      source: "Derived from Mega (320 / 4) and Mega XL (480 / 6)",
      sources: [],
      flags: { sheets: "derived", size: "estimated" },
    },

    // ---------- Kirkland Signature (Costco) ----------
    // No size names and no "= N regular" claim. claim: null, size: null.
    {
      id: "kirkland-signature-bath-tissue",
      brand: "kirkland",
      line: "Bath Tissue", size: null,
      soft: "kirkland-bath-tissue",
      name: "Bath Tissue",
      sheets: 380, width: 4.5, length: 4, ply: 2,
      claim: null,
      defaultRolls: 30,
      printedTotal: { sqft: 1425, rolls: 30 },
      note: "Costco item 6262016. No \"= N regular\" claim: Costco prints the sheet count, sheet size and total square feet instead.",
      source: "costco.com and Costco Business Center for sheets, sheet size, ply, rolls and pack total.",
      sources: [
        { name: "costco.com (sheets, size, ply, pack total)", url: "https://www.costco.com/p/-/kirkland-signature-bath-tissue-2-ply-380-sheets-30-rolls/100645583" },
        { name: "Costco Business Center (sheets, size, ply)", url: "https://www.costcobusinessdelivery.com/p/-/kirkland-signature-bath-tissue-2-ply-45-x-4-380-sheets-30-ct/100364055" },
      ],
      flags: {},
    },
    {
      id: "kirkland-signature-ultra-soft-bath-tissue",
      brand: "kirkland",
      line: "Ultra Soft", size: null,
      soft: "kirkland-ultra-soft",
      name: "Ultra Soft Bath Tissue",
      sheets: 231, width: 4.5, length: 4, ply: 2,
      claim: null,
      defaultRolls: 36,
      printedTotal: { sqft: 1039.5, rolls: 36 },
      note: "Costco item 1725952. Fewer sheets per roll than the regular Kirkland roll, same sheet size. No \"= N regular\" claim.",
      source: "costco.com and Costco Business Center for sheets, sheet size, ply, rolls and pack total.",
      sources: [
        { name: "costco.com (sheets, size, ply, pack total)", url: "https://www.costco.com/p/-/kirkland-signature-ultra-soft-bath-tissue-2-ply-231-sheets-36-rolls/4000206004" },
        { name: "Costco Business Center (sheets, size, ply)", url: "https://www.costcobusinessdelivery.com/p/-/kirkland-signature-ultrasoft-premium-bath-tissue-2-ply-45-x-40-231-sheets-36-ct/2001151698" },
      ],
      flags: {},
    },
  ],

  // Softness, 1 (scratchy) to 10 (softest), one score per product line. Each product's `soft`
  // key picks its line. There is no industry standard, so a score comes from published tests
  // first and the maker's own tier names second (see `method`). A line with no good source has
  // score: null and shows as "not rated". Regular rolls and custom rolls are never rated.
  softness: {
    checked: "October 2026",
    max: 10,
    method: [
      "Start from TechGearLab's tester-panel softness score (updated February 2025), the one current test that puts a number on most of these lines, rounded to a whole number.",
      "Move a line by one point at most when another independent test clearly disagrees: Good Housekeeping Institute (updated February 2026, a blind tester panel plus an EmTec Tissue Softness Analyzer run by NC State) or Reviewed (updated May 2024, hands-on).",
      "A brand's own tier names only order lines within that brand. Charmin sells Ultra Soft for comfort and Ultra Strong for strength; Quilted Northern calls Ultra Plush its cushiest. They never set a score on their own.",
      "A line is rated only when a current test covers that line. Tests of discontinued versions, single blog posts, retailer star ratings and paywalled results we couldn't read don't count.",
      "One score covers every size in a line (Mega, Mega XL, Super Mega): the tests rate the paper, not the roll size.",
      "Scores are coarse on purpose. Read a one-point gap as a small difference and three points or more as a clear one.",
    ],
    sources: {
      "gh-2026": {
        publisher: "Good Housekeeping Institute", title: "The Best Toilet Paper, According to Expert Testing",
        url: "https://www.goodhousekeeping.com/home-products/g32469568/best-toilet-paper/",
        date: "2026-02-10", dateKind: "updated", method: "Blind tester panel plus an EmTec Tissue Softness Analyzer run by NC State",
      },
      "tgl-2025": {
        publisher: "TechGearLab", title: "The Best Toilet Paper (Tested & Ranked)",
        url: "https://www.techgearlab.com/topics/home/best-toilet-paper",
        date: "2025-02-13", dateKind: "updated", method: "Tester panel, a softness score for each of 13 rolls",
      },
      "reviewed-2024": {
        publisher: "Reviewed (USA Today)", title: "The Best Toilet Paper",
        url: "https://www.reviewed.com/home-outdoors/best-right-now/the-best-toilet-paper",
        date: "2024-05-02", dateKind: "updated", method: "Hands-on comfort and durability testing",
      },
      "charmin-tiers": {
        publisher: "Charmin", title: "Charmin Ultra Soft vs. Ultra Strong: How to Choose Your Roll",
        url: "https://www.charmin.com/en-us/tips-and-articles/charmin-ultra-soft-vs-ultra-strong-whats-the-difference",
        date: "2026-10", dateKind: "checked", method: "The maker's description of its tiers (undated)",
      },
      "qn-plush": {
        publisher: "Quilted Northern", title: "Ultra Plush",
        url: "https://www.quiltednorthern.com/toilet-paper/ultra-plush",
        date: "2026-10", dateKind: "checked", method: "The maker's description of its tiers (undated)",
      },
    },
    lines: {
      "charmin-ultra-soft": {
        name: "Charmin Ultra Soft", score: 10, sources: ["gh-2026", "tgl-2025", "reviewed-2024", "charmin-tiers"],
        why: "TechGearLab scored it 8.6, tied for the top. Good Housekeeping's 2026 lab and panel test found it the softest it tested, so it gets the extra point. Reviewed picked it for comfort.",
      },
      "charmin-ultra-strong": {
        name: "Charmin Ultra Strong", score: 6, sources: ["tgl-2025", "reviewed-2024", "charmin-tiers"],
        why: "TechGearLab scored it 6.8, which rounds to 7. Reviewed found it not as soft as Ultra Soft or several others, and Charmin sells it for strength, so it sits a point under Quilted Northern Ultra Soft & Strong.",
      },
      "charmin-essentials": {
        name: "Charmin Essentials (1-ply)", score: null, sources: [],
        why: "The tests we found (TechGearLab 2025, Reviewed 2024) rated the old Essentials Soft, which Charmin replaced with this 1-ply roll. No test of the current roll yet.",
      },
      "qn-ultra-plush": {
        name: "Quilted Northern Ultra Plush", score: 8, sources: ["tgl-2025", "gh-2026", "reviewed-2024", "qn-plush"],
        why: "TechGearLab scored it 7.8. Good Housekeeping's 2026 test gave it some of the highest softness scores, and Reviewed called it one of the most comfortable rolls it tested.",
      },
      "qn-ultra-soft-strong": {
        name: "Quilted Northern Ultra Soft & Strong", score: 7, sources: ["tgl-2025", "gh-2026", "reviewed-2024"],
        why: "TechGearLab scored it 7.4. Good Housekeeping found it not quite as soft as Ultra Plush, and Reviewed not quite as comfortable as Charmin Ultra Soft.",
      },
      "angel-soft": {
        name: "Angel Soft", score: 5, sources: ["tgl-2025", "reviewed-2024"],
        why: "TechGearLab scored Angel Soft Double 5.4, and Reviewed found Angel Soft less comfortable than the top brands. Neither test names the Mega sizes, so this assumes the same paper.",
      },
      "kirkland-bath-tissue": {
        name: "Kirkland Signature Bath Tissue", score: null, sources: [],
        why: "The tests we found are old (Consumer Reports 2014, a 2018 panel of an older 425-sheet roll) or a single blog post. Consumer Reports' 2025 test includes Kirkland, but its results are paywalled.",
      },
      "kirkland-ultra-soft": {
        name: "Kirkland Signature Ultra Soft", score: null, sources: [],
        why: "No independent test found. The name says it's softer than the regular Kirkland roll, but a name alone isn't a score.",
      },
    },
    // Reference points that aren't products, placed on the /softness scale for comparison. They live only
    // on that page: not in the calculator, the converter, the API or the roll tables.
    anchors: [
      { id: "sandpaper", name: "Sandpaper", score: 0, note: "80 grit. Great for decks." },
      { id: "porta-potty", name: "Average port-a-potty toilet paper", score: 2, note: "One ply, on a good day." },
      { id: "cloud", name: "A cloud", score: 11, note: "Not sold in Mega rolls." },
    ],
  },

  // Older sheet counts seen on listings for the same product name.
  history: {
    "charmin-ultra-soft-mega": { sheets: 244, label: "Older listings" },
    "quilted-northern-ultra-soft-strong-mega": { sheets: 328, label: "Older packs" },
  },

  // Example prices for the deal calculator. Made up, not real store prices.
  exampleRows: [
    { productId: "charmin-ultra-soft-mega-xl", rolls: 6, price: 9.99 },
    { productId: "quilted-northern-ultra-soft-strong-mega", rolls: 12, price: 13.49 },
  ],
};
