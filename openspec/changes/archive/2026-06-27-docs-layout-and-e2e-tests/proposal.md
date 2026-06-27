## Why

Three loose ends remain after `normalize-exercise-catalog`:

1. **Migration is dead weight.** That change added `migrate.js`, a `schemaVersion`
   field, and hydrate/persist migration logic to convert old self-contained
   exercises into the normalized model. But this app has a single user on a fresh
   install path — there is no fleet of old documents to upgrade. The migration
   machinery is complexity we can delete by authoring the seed directly in the
   normalized shape.

2. **GitHub Pages serves the whole repo.** The site deploys from the repo root,
   so `openspec/`, `.claude/`, planning docs, and (soon) tests are all publicly
   served. Moving the app into `docs/` and pointing Pages at `/docs` serves only
   the app and keeps everything else private to the repo.

3. **No regression safety net.** The catalog rework touched the data model,
   commands, routing, and most render code. There are no automated tests, so the
   next change risks silent regressions.

## What Changes

- **Drop migration; assume fresh install.** Delete `migrate.js`. Author `seed.js`
  directly in the normalized shape (a `catalog` of definitions + routines holding
  `{ id, catalogId, series }` references). Remove the migration, `schemaVersion`,
  and persist-on-migration logic from `store.js`; `replaceDoc` (import) stops
  migrating. The normalized data model itself is unchanged.
- **Move the app into `docs/`.** Relocate every served file — `index.html`,
  the JS modules, `styles.css`, `sw.js`, `manifest.webmanifest`, `quotes.json`,
  `icon.svg`, `assets/`, `splash/`, `CNAME`, `.nojekyll` — into `docs/`. All
  asset references are `./`-relative, so no path edits are needed; verify the
  service-worker registration path and scope still resolve. GitHub Pages is set
  to serve from `/docs`.
- **Add a `test/` e2e suite.** A node-run Playwright suite (Playwright assumed
  globally installed; no `package.json`/npm). `node test/run.mjs` starts a static
  server over `docs/`, launches Chromium, and runs one end-to-end test per
  feature, each from a fresh IndexedDB, reporting pass/fail and exiting non-zero
  on failure. Integration tests only — no unit tests.

## Capabilities

### New Capabilities
- `deployment`: the deployable site lives in `docs/`; only app files are served.
- `e2e-testing`: a node-runnable Playwright integration suite, one test per
  feature, run without npm.

### Modified Capabilities
- `exercise-catalog`: the seed ships pre-normalized and the app assumes a fresh
  install — no document migration.

## Impact

- **Deleted:** `migrate.js`.
- **`docs/` (moved):** `index.html`, `app.js`, `commands.js`, `store.js`,
  `db.js`, `history.js`, `seed.js`, `styles.css`, `sw.js`,
  `manifest.webmanifest`, `quotes.json`, `icon.svg`, `assets/`, `splash/`,
  `CNAME`, `.nojekyll`.
- **`store.js`:** remove `migrateDoc`/`schemaVersion` handling on hydrate, the
  persist-on-migration, and the `replaceDoc` migrate call.
- **`seed.js`:** authored directly in normalized shape (small local builder).
- **`test/` (new):** `run.mjs` runner + shared helpers + one `*.test.mjs` per
  feature.
- **Repo root (not served):** `openspec/`, `.claude/`, `README.md`, `LICENSE`,
  `opsx-process.md`, `test/` stay at root.
- **GitHub Pages:** source switched to `/docs` (repo setting).
