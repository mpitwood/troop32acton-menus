# Maintainer Notes

This page is for whoever maintains the repo and the website it builds —
not needed to plan a menu or work a requirement. See [README.md](README.md)
for that.

## Folder structure

```
food/
  README.md              scout/leader-facing guide + browsable front-country menu tables
  maintainer-notes.md     this file
  TEMPLATE.md             blank page to copy when adding a new recipe
  leader-answer-key.md    compiled Real Food Check answers, for leaders/counselors
  *-worksheet.md          rank/merit-badge worksheets (scout-facing)
  front-country/           car camping — coolers and car-transportable gear OK
    breakfast/
    lunch/
    dinner/
    sides-and-appetizers/
    desserts/
    snacks/
  backpacking/              weight-critical menus
    README.md                own guide + browsable menu tables, own TEMPLATE
    breakfast/
    lunch/
    dinner/
    snacks/
  site/                      website build tooling (see "Building the website" below)
  docs/                       generated website output — GitHub Pages serves this folder
```

Front-country and backpacking each keep one combined README (guide +
browsable menu tables) rather than a separate README/INDEX pair — having
two documents for the same section was confusing to read.

## Adding a new recipe

Copy [TEMPLATE.md](TEMPLATE.md) into the right `front-country/<category>/`
folder, fill it in, and add a row to the
[Browse the menu](README.md#browse-the-menu) tables in README.md. For
backpacking recipes, use [backpacking/TEMPLATE.md](backpacking/TEMPLATE.md)
and add a row to
[backpacking/README.md](backpacking/README.md#browse-the-menu) instead —
different template, different tables. Then rebuild the site (below) so
the new page actually appears.

## Pricing methodology

Cost estimates are built for a **Boston-area (Greater Boston) grocery
trip**, not a national average — this troop is in a high-cost-of-living
area and national figures were running noticeably low.

- **Directly sourced Boston prices** (via [Numbeo Boston food
  prices](https://www.numbeo.com/food-prices/in/Boston), a
  crowd-sourced/aggregated price index, checked July 2026): milk $4.65/gal,
  eggs $5.75/dozen, cheese ~$7/lb, chicken (breast/fillet) $6.35/lb, beef
  (round/steak-cut) $8.55/lb, bread ~$4/loaf, rice $3.00/lb, apples
  $3.40/lb, bananas $0.96/lb, tomatoes $3.25/lb, potatoes $2.00/lb, onions
  $1.85/lb, lettuce $2.80/head.
- **Everything else** (bacon, sausage, deli meat, canned goods, pasta,
  tortillas, box mixes, most produce not listed above, pantry items) is a
  **national average estimate** (rough figures from general knowledge, not
  a live price check) **scaled up ~1.35x** — the Boston-vs-national premium
  observed across the sourced staples above ran from about 1.27x (beef) to
  1.52x (chicken), so 1.35x is a middle-of-the-road estimate applied
  consistently rather than a per-item lookup.
- Eggs are a known exception: the sourced Boston price was running about
  2.7x the national figure at the time of the check, likely reflecting a
  temporary regional supply issue rather than a stable premium — treat the
  egg-heavy recipes' costs as the most likely to have moved since.
- **None of this is a live per-store price check.** It's a planning-stage
  estimate, not a receipt. Before finalizing a shopping budget, a patrol
  should sanity-check a few line items against Market Basket, Stop & Shop,
  or wherever they're actually shopping — prices vary by store even within
  Boston, and grocery inflation was running ~4% year-over-year in the
  Boston area as of mid-2026.

## Building the website

The site under `docs/` is generated from the Markdown files — the Markdown
stays the single source of truth. All the build tooling lives in `site/`,
away from the recipe content:

```
site/
  build.js       Node build script — reads every .md file, writes docs/
  style.css      site stylesheet
  filter.js      client-side recipe search/filter, used on the homepage
  images/        source images (build.js copies these into docs/assets/images/)
```

**The site rebuilds and republishes itself automatically.** A GitHub
Actions workflow (`.github/workflows/pages.yml`) runs `npm run build` and
deploys the result to GitHub Pages on every push to `main` — including an
edit made straight in GitHub's web editor, no local setup needed. Check
the Actions tab on the repo to watch a deploy or see why one failed.
`docs/` is git-ignored: it's a build artifact now, not something anyone
commits.

To preview a change locally before pushing:

```
npm install   # first time only
npm run build
```

Then open `docs/index.html` in a browser (or the specific page you
changed).

A few pages are deliberately **not** linked from the site's main
navigation, on purpose:

- `leader-answer-key.md` — linked once, from the bottom of the published
  README, not from the nav or homepage. It compiles the same Real Food
  Check content that's already public on every recipe page, so this isn't
  real access control — it's just not one click away from a scout
  browsing the site.
- `maintainer-notes.md` (this file) — linked once, from the bottom of the
  published README.
- `TEMPLATE.md` / `backpacking/TEMPLATE.md` — built and linked from this
  page, but not from the main nav.

The two official BSA requirement PDFs (`First-Class.pdf`,
`Second-Class-v2.pdf`) and the `import/` folder are intentionally excluded
from git via `.gitignore` — they're either copyrighted BSA material or raw
working files, not meant for a public repo.
