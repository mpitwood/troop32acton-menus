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
  ['front-country/OVERVIEW.html', 'Front-Country Guide'],
  ['backpacking/OVERVIEW.html', 'Backpacking Guide'],
];

const WORKSHEETS = [
  ['second-class-menu-worksheet.html', 'Second Class (req 2e)'],
  ['first-class-menu-worksheet.html', 'First Class (req 2a)'],
  ['cooking-mb-worksheet-req5.html', 'Cooking MB — req 5 (camp)'],
  ['cooking-mb-worksheet-req6.html', 'Cooking MB — req 6 (trail)'],
];

function layout({ title, bodyHtml, relOutPath, description, bodyClass }) {
  const prefix = depthPrefix(relOutPath);
  const nav = NAV_ITEMS.map(
    ([href, label]) => `<a href="${prefix}${href}">${label}</a>`
  ).join('\n      ');
  const worksheetLinks = WORKSHEETS.map(
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
      <span class="nav-group">Worksheets
        <span class="nav-dropdown">
          ${worksheetLinks}
        </span>
      </span>
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
  for (const [file] of WORKSHEETS) {
    buildDocPage(file.replace(/\.html$/, '.md'), file, { worksheet: true });
  }
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

  // recipes
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
  const BACK_CATS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (const cat of BACK_CATS) {
    const dir = `backpacking/${cat}`;
    for (const file of listMdFiles(dir)) {
      const rel = `${dir}/${file}`;
      const out = `${dir}/${file.replace(/\.md$/, '.html')}`;
      recipes.push(buildRecipePage(rel, out, 'Backpacking', CATEGORY_LABEL[cat]));
    }
  }

  // data file consumed by the homepage browser (script tag, not fetch, so
  // it also works when the folder is opened locally over file://)
  const dataJs = `const RECIPES = ${JSON.stringify(recipes, null, 0)};\n`;
  fs.writeFileSync(path.join(OUT, 'assets', 'recipes-data.js'), dataJs, 'utf8');

  buildHomepage(recipes);

  console.log(`Built ${recipes.length} recipe pages + docs into docs/`);
}

function buildHomepage(recipes) {
  const meals = uniqSorted(recipes.map((r) => r.meal));
  const methods = uniqSorted(recipes.map((r) => r.method));

  const bodyHtml = `
<figure class="hero">
  <img src="assets/images/hero-dutch-oven.jpg" alt="A dutch oven meal cooking over campfire coals">
  <figcaption>Photo: vastateparksstaff, <a href="https://commons.wikimedia.org/wiki/File:Campfire_Cooking-_Steak_Dinner-_smashed_potatoes_cooking_in_the_dutch_oven_ksu_(9201699045).jpg">Wikimedia Commons</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a></figcaption>
</figure>
<h1>Troop 32 Acton Menu Book</h1>
<p class="lede">A browsable library of pre-planned camp meals — ${recipes.length}
recipes across front-country (car camping) and backpacking. Pick a meal,
copy the ingredient list onto a shopping list, and go. See the
<a href="front-country/OVERVIEW.html">Front-Country Guide</a> or the
<a href="backpacking/OVERVIEW.html">Backpacking Guide</a> for the full
system plus plain browsable tables, or use the search/filter below.</p>

<p class="lede">Working on a rank or merit badge requirement? Start with a
worksheet instead of a recipe page — they walk you through the same
food-group and nutrition reasoning yourself, rather than reading it off a
page:</p>
<ul class="worksheet-list">
  <li><a href="second-class-menu-worksheet.html">Second Class — requirement 2e</a></li>
  <li><a href="first-class-menu-worksheet.html">First Class — requirement 2a</a></li>
  <li><a href="cooking-mb-worksheet-req5.html">Cooking merit badge — requirement 5 (camp cooking)</a></li>
  <li><a href="cooking-mb-worksheet-req6.html">Cooking merit badge — requirement 6 (trail cooking)</a></li>
</ul>

<section class="browser">
  <h2>Browse recipes</h2>
  <div class="filters">
    <input id="f-search" type="search" placeholder="Search titles...">
    <select id="f-location">
      <option value="">Any trip type</option>
      <option value="Front-Country">Front-Country</option>
      <option value="Backpacking">Backpacking</option>
    </select>
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
  const html = layout({ title: 'Home', bodyHtml, relOutPath: 'index.html' })
    .replace('</body>', '<script src="assets/recipes-data.js"></script>\n<script src="assets/filter.js"></script>\n</body>');
  writeOut('index.html', html);
}

function uniqSorted(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}

main();
