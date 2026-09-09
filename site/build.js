// Builds docs/ (static site, served by GitHub Pages) from the Markdown
// recipe repository. The Markdown files remain the single source of truth
// -- this script only reads them. Re-run with `npm run build` after
// editing any .md file.
'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

marked.use({ gfm: true, breaks: false });

// GitHub-style heading slugs, since marked no longer adds heading ids by
// default -- needed so existing "file.md#some-heading" links keep working
// once rewritten to "file.html#some-heading".
function githubSlug(text, seen) {
  let slug = text
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (seen.has(slug)) {
    let n = 1;
    while (seen.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  seen.add(slug);
  return slug;
}

// Recipe pages write "~5.3 oz" / "~613 kcal" style approximations, often
// several to a line. marked's GFM "del" (strikethrough) rule matches a
// single "~" against the *next* single "~" it finds -- not just proper
// "~~double~~" syntax -- so two unrelated approximations on the same line
// were getting swallowed into a <del> span. Escaping every literal "~"
// keeps the character but stops marked from reading it as syntax; this
// repo never uses real strikethrough, so this is safe everywhere.
function escapeTildes(md) {
  return md.replace(/~/g, '\\~');
}

function renderMarkdownWithHeadingIds(md) {
  const seen = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = (text, level, raw) => {
    // `raw` is the plain heading text; `text` is HTML-escaped (an
    // apostrophe becomes "&#39;"), which corrupted slugs like
    // "Sample day's menu" into "sample-day39s-menu".
    const id = githubSlug(raw, seen);
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };
  return marked.parse(escapeTildes(md), { renderer });
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function readMd(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function rewriteLinks(md) {
  // internal links point at .md files; the site serves .html instead.
  // (anchor chars restricted to word/hyphen so this can't run past a "]"
  // into the visible link label when text and href both mention a path)
  return md.replace(/\.md(#[\w-]*)?\)/g, '.html$1)');
}

function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : 'Untitled';
}

function stripTitleLine(md) {
  return md.replace(/^#\s+.+\n/, '');
}

// Pull the italic metadata line (Meal · Course · Diet · ... ) that follows
// the title on every recipe page, without removing it from the body.
function extractSummary(md) {
  const body = stripTitleLine(md).replace(/^\s+/, '');
  const m = body.match(/^\*([\s\S]*?)\*/);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim();
}

function parseRecipeMeta(summary) {
  const meta = {
    meal: '', course: '', diet: '', method: '',
    nutFree: '', eggFree: '', serves: '', prep: '', cook: '',
    weight: '', calories: '', protein: '',
  };
  if (!summary) return meta;
  const segs = summary.split('·').map((s) => s.trim()).filter(Boolean);
  const unlabeled = [];
  for (const seg of segs) {
    if (/^nut-free/i.test(seg)) meta.nutFree = seg.replace(/^nut-free:?\s*/i, '').trim();
    else if (/^egg-free/i.test(seg)) meta.eggFree = seg.replace(/^egg-free:?\s*/i, '').trim();
    else if (/^serves/i.test(seg)) meta.serves = seg.replace(/^serves:?\s*/i, '').trim();
    else if (/^weight/i.test(seg)) meta.weight = seg.replace(/^weight:?\s*/i, '').trim();
    else if (/kcal/i.test(seg)) meta.calories = seg;
    else if (/protein/i.test(seg)) meta.protein = seg;
    else if (/^prep/i.test(seg)) meta.prep = seg.replace(/^prep:?\s*/i, '').trim();
    else if (/^cook/i.test(seg)) meta.cook = seg.replace(/^cook:?\s*/i, '').trim();
    else unlabeled.push(seg);
  }
  [meta.meal, meta.course, meta.diet, meta.method] = unlabeled;
  return meta;
}

function depthPrefix(relOutPath) {
  const dir = path.dirname(relOutPath);
  if (dir === '.' || dir === '') return '';
  const segs = dir.split('/').filter(Boolean);
  return segs.map(() => '../').join('');
}

const NAV_ITEMS = [
  ['index.html', 'Home'],
  ['front-country/OVERVIEW.html', 'Front-Country'],
  ['backpacking/under-construction.html', 'Backpacking (Coming Soon)'],
  ['browse.html', 'Browse Recipes'],
];

// Worksheet pages (second-class-menu-worksheet.md, first-class-menu-
// worksheet.md, cooking-mb-worksheet-req5.md, cooking-mb-worksheet-req6.md)
// still build below -- reachable by direct URL -- but per the
// scoutmaster's direction they're no longer promoted from nav or the
// homepage: paired with the menu guide, the paperwork read as overwhelming
// next to just leaning on senior scouts' existing know-how. See
// menu-system-talking-points.md for the replacement pitch.

function layout({ title, bodyHtml, relOutPath, description, bodyClass }) {
  const prefix = depthPrefix(relOutPath);
  const nav = NAV_ITEMS.map(
    ([href, label]) => `<a href="${prefix}${href}">${label}</a>`
  ).join('\n      ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Troop 32 Acton Menu Book</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">\n` : ''}<link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<header class="site-header">
  <div class="site-header-inner">
    <a class="brand" href="${prefix}index.html">Troop 32 Acton &middot; Menu Book</a>
    <nav class="main-nav">
      ${nav}
    </nav>
  </div>
</header>
<main class="page">
${bodyHtml}
</main>
<footer class="site-footer">
  <p>Menu-planning reference for Troop 32 Acton, not a substitute for
  reading the current requirements at scouting.org. Source Markdown lives
  in the project repository.</p>
</footer>
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeOut(relOutPath, html) {
  const full = path.join(OUT, relOutPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, 'utf8');
}

// ---------------------------------------------------------------------
// generic markdown page -> html page
// ---------------------------------------------------------------------

function buildDocPage(relSrcMd, relOutPath, { worksheet = false } = {}) {
  const raw = readMd(relSrcMd);
  const title = extractTitle(raw);
  const bodyMd = rewriteLinks(stripTitleLine(raw));
  const bodyHtml = `<h1>${escapeHtml(title)}</h1>\n` + renderMarkdownWithHeadingIds(bodyMd);
  // worksheet pages get taller table cells and write-in lines -- a fill-in
  // table with a single blank row is useless if there's no room to
  // actually write in it by hand.
  const html = layout({ title, bodyHtml, relOutPath, bodyClass: worksheet ? 'worksheet-page' : undefined });
  writeOut(relOutPath, html);
  return title;
}

// ---------------------------------------------------------------------
// recipe pages (also produce structured metadata for the browse index)
// ---------------------------------------------------------------------

function buildRecipePage(relSrcMd, relOutPath, location, category) {
  const raw = readMd(relSrcMd);
  const title = extractTitle(raw);
  const summary = extractSummary(raw);
  const meta = parseRecipeMeta(summary);
  const bodyMd = rewriteLinks(stripTitleLine(raw));
  const bodyHtml = `<p class="crumb">${location} &rsaquo; ${category}</p>\n<h1>${escapeHtml(title)}</h1>\n` + renderMarkdownWithHeadingIds(bodyMd);
  const description = summary ? summary.replace(/·/g, '—').slice(0, 200) : '';
  const html = layout({ title, bodyHtml, relOutPath, description });
  writeOut(relOutPath, html);
  return {
    title,
    url: relOutPath.replace(/\\/g, '/'),
    location,
    category,
    ...meta,
  };
}

function listMdFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.md'))
    .sort();
}

const CATEGORY_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  'sides-and-appetizers': 'Sides & Appetizers',
  desserts: 'Desserts',
  snacks: 'Snacks',
};

// ---------------------------------------------------------------------
// main build
// ---------------------------------------------------------------------

function main() {
  // clean docs/ but keep it idempotent/simple: just wipe and rebuild.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // static assets (source lives alongside build.js in site/, not mixed
  // in with the recipe content)
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, 'style.css'),
    path.join(OUT, 'assets', 'style.css')
  );
  fs.copyFileSync(
    path.join(__dirname, 'filter.js'),
    path.join(OUT, 'assets', 'filter.js')
  );
  const imagesDir = path.join(__dirname, 'images');
  const outImagesDir = path.join(OUT, 'assets', 'images');
  fs.mkdirSync(outImagesDir, { recursive: true });
  for (const file of fs.readdirSync(imagesDir)) {
    fs.copyFileSync(path.join(imagesDir, file), path.join(outImagesDir, file));
  }

  // root docs
  buildDocPage('front-country/OVERVIEW.md', 'front-country/OVERVIEW.html');
  buildDocPage('backpacking/OVERVIEW.md', 'backpacking/OVERVIEW.html');
  // still built (direct-URL reachable) though no longer promoted -- see
  // the note above layout() for why.
  const WORKSHEET_FILES = [
    'second-class-menu-worksheet.html',
    'first-class-menu-worksheet.html',
    'cooking-mb-worksheet-req5.html',
    'cooking-mb-worksheet-req6.html',
  ];
  for (const file of WORKSHEET_FILES) {
    buildDocPage(file.replace(/\.html$/, '.md'), file, { worksheet: true });
  }
  buildDocPage('menu-system-talking-points.md', 'menu-system-talking-points.html');
  // leader answer key: built, but intentionally not linked from nav/index
  // (see NAV_ITEMS / homepage) so it isn't one click away from a scout
  // browsing the site -- the worksheets ask scouts to work answers out
  // themselves rather than read them off a recipe's Real Food Check.
  buildDocPage('leader-answer-key.md', 'leader-answer-key.html');
  // maintainer-only pages: built and cross-linked with each other, but
  // not in NAV_ITEMS -- only reachable via the link at the bottom of the
  // published Overview.
  buildDocPage('maintainer-notes.md', 'maintainer-notes.html');
  buildDocPage('front-country/TEMPLATE.md', 'front-country/TEMPLATE.html');
  buildDocPage('backpacking/TEMPLATE.md', 'backpacking/TEMPLATE.html');

  // front-country recipes -- promoted (nav, homepage, browse page)
  const recipes = [];
  const FRONT_CATS = ['breakfast', 'lunch', 'dinner', 'sides-and-appetizers', 'desserts', 'snacks'];
  for (const cat of FRONT_CATS) {
    const dir = `front-country/${cat}`;
    for (const file of listMdFiles(dir)) {
      const rel = `${dir}/${file}`;
      const out = `${dir}/${file.replace(/\.md$/, '.html')}`;
      recipes.push(buildRecipePage(rel, out, 'Front-Country', CATEGORY_LABEL[cat]));
    }
  }
  // backpacking recipes -- still built (direct-URL reachable, and the
  // Front-Country Recipes/Backpacking Recipes Word docs still need this
  // content) but deliberately left out of recipes-data.js/browse.html:
  // the whole Backpacking section of the site points at an "under
  // construction" placeholder for now, so promoting individual backpacking
  // recipe pages in the browse grid would contradict that.
  const BACK_CATS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (const cat of BACK_CATS) {
    const dir = `backpacking/${cat}`;
    for (const file of listMdFiles(dir)) {
      const rel = `${dir}/${file}`;
      const out = `${dir}/${file.replace(/\.md$/, '.html')}`;
      buildRecipePage(rel, out, 'Backpacking', CATEGORY_LABEL[cat]);
    }
  }
  buildUnderConstruction();

  // data file consumed by browse.html (script tag, not fetch, so it also
  // works when the folder is opened locally over file://)
  const dataJs = `const RECIPES = ${JSON.stringify(recipes, null, 0)};\n`;
  fs.writeFileSync(path.join(OUT, 'assets', 'recipes-data.js'), dataJs, 'utf8');

  buildHomepage(recipes.length);
  buildBrowsePage(recipes);

  console.log(`Built ${recipes.length} recipe pages + docs into docs/`);
}

// Simple landing page: two big cards (Front-Country / Backpacking) instead
// of the full searchable recipe grid, which now lives at browse.html. A
// scoutmaster or patrol leader arriving fresh should land on "here's how
// the system works," not a wall of 30 recipe cards to sort through.
function buildHomepage(frontCountryCount) {
  const bodyHtml = `
<figure class="hero">
  <img src="assets/images/hero-dutch-oven.jpg" alt="A dutch oven meal cooking over campfire coals">
  <figcaption>Photo: vastateparksstaff, <a href="https://commons.wikimedia.org/wiki/File:Campfire_Cooking-_Steak_Dinner-_smashed_potatoes_cooking_in_the_dutch_oven_ksu_(9201699045).jpg">Wikimedia Commons</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a></figcaption>
</figure>
<h1>Troop 32 Acton Menu Book</h1>
<p class="lede">Pre-planned camp meals, ready to pick from instead of
planning from scratch — shopping lists, allergy tags, and cost estimates
already worked out.</p>

<div class="landing-cards">
  <a class="landing-card" href="front-country/OVERVIEW.html">
    <span class="lc-title">Front-Country</span>
    <span class="lc-desc">Car camping — ${frontCountryCount} recipes across
    breakfast, lunch, dinner, sides, desserts, and snacks.</span>
    <span class="lc-cta">Open the guide →</span>
  </a>
  <a class="landing-card landing-card-soon" href="backpacking/under-construction.html">
    <span class="lc-title">Backpacking</span>
    <span class="lc-desc">Trail meals for weight-critical trips.</span>
    <span class="lc-badge">Coming soon</span>
  </a>
</div>

<p class="lede">Leaders: <a href="menu-system-talking-points.html">a 2-3
minute troop intro</a> covering how the menu system works and why — how
to plan a meal, vegetarian/allergy policy, nutrition, pricing, and
advancement in priority order — as speaking notes, not a script.</p>

<p class="lede">Already know what you're looking for? <a href="browse.html">Browse
&amp; filter every recipe →</a></p>
`;
  const html = layout({ title: 'Home', bodyHtml, relOutPath: 'index.html' });
  writeOut('index.html', html);
}

// The old homepage's searchable/filterable grid, now a secondary page --
// front-country only (see the note above the backpacking recipe loop).
function buildBrowsePage(recipes) {
  const meals = uniqSorted(recipes.map((r) => r.meal));
  const methods = uniqSorted(recipes.map((r) => r.method));

  const bodyHtml = `
<h1>Browse Recipes</h1>
<p class="lede">All ${recipes.length} Front-Country recipes — search or
filter to narrow it down. Backpacking recipes aren't listed here yet; see
the <a href="backpacking/under-construction.html">Backpacking page</a>.</p>

<section class="browser">
  <div class="filters">
    <input id="f-search" type="search" placeholder="Search titles...">
    <select id="f-meal">
      <option value="">Any meal</option>
      ${meals.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('\n      ')}
    </select>
    <select id="f-method">
      <option value="">Any cook method</option>
      ${methods.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('\n      ')}
    </select>
    <label><input type="checkbox" id="f-nutfree"> Nut-free only</label>
    <label><input type="checkbox" id="f-eggfree"> Egg-free only</label>
    <label><input type="checkbox" id="f-veg"> Vegetarian/vegan-friendly only</label>
  </div>
  <p id="f-count" class="f-count"></p>
  <div id="f-results" class="recipe-grid"></div>
</section>
`;
  const html = layout({ title: 'Browse Recipes', bodyHtml, relOutPath: 'browse.html' })
    .replace('</body>', '<script src="assets/recipes-data.js"></script>\n<script src="assets/filter.js"></script>\n</body>');
  writeOut('browse.html', html);
}

// A deliberately obnoxious late-90s "under construction" page for the
// Backpacking section, which isn't ready to promote yet (see
// menu-system-talking-points.md: "Backpacking will follow"). Fully
// self-contained -- skips the normal layout()/site chrome on purpose, this
// is the one page meant to look like it teleported in from 1997.
function buildUnderConstruction() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>~*~ BACKPACKING PAGE ~*~ Under Construction ~*~</title>
<style>
  body {
    margin: 0;
    padding: 2rem 1rem 4rem;
    background-color: #000;
    background-image: repeating-linear-gradient(
      45deg, #ffcc00, #ffcc00 20px, #000 20px, #000 40px
    );
    font-family: "Comic Sans MS", "Comic Sans", cursive, sans-serif;
    color: #fff;
    text-align: center;
  }
  .panel {
    max-width: 640px;
    margin: 0 auto;
    background: #ff00ff;
    border: 6px dashed #00ffff;
    padding: 1.5rem;
    box-shadow: 8px 8px 0 #000;
  }
  h1 {
    font-size: 2rem;
    color: #ffff00;
    text-shadow: 3px 3px 0 #000;
    animation: blink 1s steps(1) infinite;
    margin: 0 0 0.5rem;
  }
  @keyframes blink { 50% { opacity: 0; } }
  .rainbow {
    height: 8px;
    margin: 0.75rem 0;
    background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet);
  }
  .marquee-wrap {
    overflow: hidden;
    background: #000;
    border: 2px inset #ccc;
    padding: 0.4rem 0;
    margin: 1rem 0;
  }
  .marquee {
    display: inline-block;
    white-space: nowrap;
    color: #0f0;
    font-family: "Courier New", monospace;
    padding-left: 100%;
    animation: scroll 12s linear infinite;
  }
  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
  .construction-banner {
    font-size: 2.5rem;
    animation: wobble 0.6s ease-in-out infinite alternate;
  }
  @keyframes wobble {
    from { transform: rotate(-8deg); }
    to { transform: rotate(8deg); }
  }
  .bg-yellow {
    background: #fff200;
    color: #000;
    font-weight: bold;
    padding: 0.6rem;
    border: 3px solid #000;
    margin: 1rem 0;
    font-family: "Times New Roman", Times, serif;
  }
  .hitcounter {
    font-family: "Courier New", monospace;
    background: #000;
    color: #0f0;
    letter-spacing: 0.2em;
    padding: 0.3rem 0.6rem;
    border: 2px inset #888;
    display: inline-block;
    font-size: 1.1rem;
  }
  .badge-row {
    margin-top: 1.5rem;
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }
  .badge-row span {
    background: #000;
    color: #fff;
    border: 1px solid #fff;
    padding: 0.3rem 0.5rem;
  }
  a { color: #00ffff; }
  a:visited { color: #ff66ff; }
  .home-link {
    display: inline-block;
    margin-top: 2rem;
    background: #fff;
    color: #000;
    padding: 0.6rem 1.2rem;
    text-decoration: none;
    border: 3px outset #ccc;
    font-weight: bold;
  }
</style>
</head>
<body>
<div class="panel">
  <div class="construction-banner">🚧👷‍♂️🔨🚧</div>
  <h1>~*~ UNDER CONSTRUCTION ~*~</h1>
  <p class="bg-yellow">THE BACKPACKING SECTION OF THIS SITE IS NOT YET READY.<br>PLEASE CHECK BACK SOON!!</p>
  <div class="rainbow"></div>
  <div class="marquee-wrap">
    <span class="marquee">*** thank you for your patience *** this page works best with Netscape Navigator 3.0 *** more trail recipes coming soon *** you are visitor number 000042 *** ***</span>
  </div>
  <p>In the meantime, front-country (car camping) recipes are ready to go:</p>
  <p><a href="../front-country/OVERVIEW.html">→ Front-Country Guide ←</a></p>
  <div class="rainbow"></div>
  <p>Hits: <span class="hitcounter">000042</span></p>
  <div class="badge-row">
    <span>BEST VIEWED AT 800x600</span>
    <span>NETSCAPE NOW!</span>
    <span>UNDER CONSTRUCTION SINCE 2026</span>
  </div>
  <a class="home-link" href="../index.html">&larr; Back to the Menu Book home page</a>
</div>
</body>
</html>
`;
  writeOut('backpacking/under-construction.html', html);
}

function uniqSorted(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}

main();
