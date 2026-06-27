## 1. Drop migration (fresh-install only)

- [x] 1.1 Rewrite `seed.js` to export the normalized doc directly (catalog of
      definitions + routines as `{ id, catalogId, series }` references) via a
      small in-file builder; no dependency on `migrate.js`
- [x] 1.2 Remove migration from `store.js`: drop the `migrateDoc`/`schemaVersion`
      handling in `#hydrate`, the persist-on-migration, and the `replaceDoc`
      migrate call (load/import use the doc as-is)
- [x] 1.3 Delete `migrate.js`
- [x] 1.4 Grep for stray `schemaVersion` / `migrateDoc` references and remove them

## 2. Move the app into `docs/`

- [x] 2.1 Create `docs/` and move served files into it: `index.html`, `app.js`,
      `commands.js`, `store.js`, `db.js`, `history.js`, `seed.js`, `styles.css`,
      `sw.js`, `manifest.webmanifest`, `quotes.json`, `icon.svg`, `assets/`,
      `splash/`, `CNAME`, `.nojekyll` (use `git mv` to preserve history)
- [x] 2.2 Verify all relative references still resolve from `docs/` (scripts,
      styles, manifest, icons, splash) and the SW `SHELL` list
- [x] 2.3 Verify the service-worker registration path/scope resolves under
      `docs/`; bump the SW `VERSION`
- [x] 2.4 Confirm no app file remains at the repo root; tooling/planning files
      (`openspec/`, `.claude/`, `README.md`, `LICENSE`, `opsx-process.md`) stay
- [x] 2.5 Document switching GitHub Pages source to `/docs` (repo setting) in
      `README.md`

## 3. Cucumber + Playwright harness (`test/`)

- [x] 3.1 `test/Gemfile` declaring `cucumber`, `playwright-ruby-client`,
      `rspec-expectations`, `webrick`
- [x] 3.2 `test/features/support/env.rb`: WEBrick static server over `docs/` on a
      free port (background thread, `at_exit` shutdown)
- [x] 3.3 `env.rb`: boot Playwright once (Chromium headless) reused across
      scenarios; `Before`/`After` hooks for a fresh `BrowserContext` per scenario
- [x] 3.4 World mixin: `open_app`/navigation, click/fill, `wait_for`, and
      `app_doc` (read persisted doc from IndexedDB); include `RSpec::Expectations`
- [x] 3.5 `test/cucumber.yml` + shared `step_definitions/` (navigation, catalog,
      workout, common)

## 4. Feature files (cover all app features)

- [x] 4.1 `home.feature` — routines list, progress, navigation
- [x] 4.2 `workout.feature` — view routine, mark a set, reset checklist
- [x] 4.3 `routines_edit.feature` — rename / add / delete a routine
- [x] 4.4 `workout_edit.feature` — add (catalog pick), edit series, remove
- [x] 4.5 `catalog.feature` — list (deduped), search, open detail
- [x] 4.6 `catalog_edit.feature` — create, rename-propagation, cascade delete + undo
- [x] 4.7 `catalog_pick.feature` — pick inserts a reference into the routine
- [x] 4.8 `exercise_detail.feature` — sessions/stats + edit drawer
- [x] 4.9 `dashboard.feature` — heatmap + latest exercises after logging
- [x] 4.10 `undo_redo.feature` — undo and redo a change
- [x] 4.11 `motivation.feature` — daily quote shows and returns

## 5. Verify

- [x] 5.1 `ruby run.rb` runs all feature files green (23 scenarios, 101 steps)
- [x] 5.2 Serve `docs/` and smoke-check the app loads and the catalog screen works
