# 🌊 ATX UTL — Season Dashboard

A modern, zero-build web app for the **Austin Underwater Torpedo League**. It
replicates the original [ATX-UTL-POC](https://reuhdz.github.io/ATX-UTL-POC) site
and improves on it: a polished deep-water UI, a **single data source** that feeds
every tab, a seeded **random dummy-data** season, richer charts, and a new
**Research** tab of scientific studies on UTL and Underwater Rugby (UWR).

Pure **static HTML + CSS + vanilla JS** (Chart.js vendored, no CDN, no build
step). Opens by double-clicking `index.html`, and deploys to **GitHub Pages** by
just pushing the folder.

---

## Quick start

- **Run locally:** open `index.html` in any browser, **or** run a static server:
  ```bash
  node .preview-server.js      # then open http://localhost:4173
  # or:  python -m http.server 4173
  ```
- **Reshuffle the season:** change `LEAGUE.seed` in `js/data.js` and reload —
  the whole schedule, scores and box scores regenerate deterministically.

---

## The tabs

| Tab | What it shows |
|-----|---------------|
| 📊 **Dashboard** | Headline stat cards, live standings (hover ⓘ for a column glossary), top-rated players (hover ⓘ for the rating formula), next games, recent results, and a goals-for/against chart. |
| 🛡️ **Teams** | A card per team: rank, W-D-L, points, captain (C), aggregate stats, roster with player level (Pro/Rookie), plus a free-agents strip. |
| 👤 **Roster** | Full sortable/filterable player table (by team **or** free agents) with the transparent rating formula and a hover info pane. |
| 🗓️ **Schedule** | Every round of the double round-robin — finals show scores, upcoming show fixtures. |
| 📈 **Stats** | A **player spotlight** tile (filter by roster → pick a player → see their radar + line), top scorers, steals leaders, goal-share doughnut, team-profile radar, cumulative points line. |
| 🎬 **Media** | Featured clip + a highlight gallery of game photos and videos (demo tiles, easily swapped for real media). |
| ✅ **Attendance** | Availability grid for the next league nights (In / Maybe / Out per player), team filter, per-night counts, and each player’s availability %. |
| 🔬 **Research** | Cited scientific studies on UTL background, UWR physiology, and apnea/breath-hold training + a safety panel. |
| 📖 **Rules & FAQ** | The real UTL ruleset plus a FAQ accordion. |

**Player profiles:** click any player name anywhere (leaderboards, rosters, tables, attendance) to open a profile modal with their rating, totals, a skills radar, per-match game log (guest games flagged), and availability. **Team names** everywhere link to the Teams tab and highlight that team.

Everything derives from one dataset (the real ATX UTL active-player roster), so the tabs never disagree.

---

## Improvements over the original

- **One source of truth.** `js/data.js` holds teams, the real active-player
  roster (including free agents) and a fixture list; standings, leaderboards,
  ratings, profiles, attendance and all charts are *computed*, not hand-typed.
- **Seeded randomness.** A `mulberry32` PRNG generates a full season (scores,
  per-player box scores, free-agent guest appearances, availability) that is
  random but stable across reloads.
- **Transparent ratings** with a small-sample guard. The 1–10 rating is a
  documented weighted formula (÷ matches + 2, to steady low-game players) shown
  on the Roster tab and in hover info panes.
- **Theming.** Light/dark toggle **+** three accent presets (Aqua / Reef / Abyss),
  persisted in `localStorage`.
- **New Research tab** with peer-reviewed sources and breath-hold safety guidance.
- **Responsive**, keyboard-navigable, and offline-capable.

---

## File structure

```
ATX-UTL/
├── index.html            # app shell: header, theming, tab nav
├── README.md             # this file
├── css/styles.css        # deep-water theme, light/dark + accent presets
├── js/
│   ├── data.js           # SINGLE SOURCE OF TRUTH: teams, players, seeded season + derivations
│   ├── content.js        # rules, FAQ, and the research library (with citations)
│   ├── charts.js         # Chart.js wrappers (bar/line/radar/doughnut)
│   └── app.js            # router, theming, and all tab renderers
├── vendor/chart.umd.js   # Chart.js 4.x (vendored — works offline)
└── .preview-server.js    # tiny static server for local preview
```

## Editing the data

Everything is data in `js/data.js`:
- `TEAMS` — clubs, colors, captains.
- `PLAYERS` — roster; each `skill` (0–1) gently biases generated box scores.
- `RATING.weights` — tune how goals/assists/steals/blocks/turnovers score.
- `LEAGUE.seed` — change to regenerate the whole season.

Editorial copy (rules, FAQ, studies) lives in `js/content.js`.

## Deploy to GitHub Pages

This is a zero-build static site with **all-relative paths**, so it works whether
it's served from `you.github.io/<repo>/` (project page) or a custom domain.

### Upload to your personal repo

Use the **contents of this `ATX-UTL/` folder as the repo root** (so `index.html`
is at the top level). From inside the folder:

```bash
cd ATX-UTL
git init -b main
git add .
git commit -m "ATX UTL season dashboard"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Turn on Pages — pick ONE method

- **A) GitHub Actions (recommended, auto-deploys on push).** A workflow is
  included at `.github/workflows/deploy.yml`. In your repo go to
  **Settings → Pages → Build and deployment → Source: “GitHub Actions.”** Every
  push to `main` publishes automatically.
- **B) Deploy from a branch (no Actions).** **Settings → Pages → Source: “Deploy
  from a branch” → Branch: `main` → Folder: `/ (root)`.** The included
  `.nojekyll` file makes sure GitHub serves the files as-is.

Then open the published URL (shown on the Pages settings screen).

> If you'd rather keep the site in a **subfolder** of an existing repo instead of
> at the root: use method **B** and set the Pages folder to that subfolder, **or**
> edit the workflow's `path:` (in `deploy.yml`) to point at the subfolder.

### Notes

- `js/data.js` `LEAGUE.seed` controls the generated season — change it to reshuffle.
- Game-film tiles link to `MEDIA.filmBase` (default `clips/`). Create those folders
  in the repo (or point `filmBase` at a Drive/S3 URL) so the links resolve.
- `.preview-server.js` is a local convenience only and is git-ignored — GitHub
  Pages doesn't need it.

## Research sources

See the **Research** tab for full citations (UTL Nation rules, UWR physiology in
the *Journal of Human Sciences* and *JPES*, and dry-dynamic-apnea work in
*Frontiers in Physiology*). Breath-hold work carries real risk — **never train
breath-holding alone or unsupervised**; shallow-water blackout gives no warning.
