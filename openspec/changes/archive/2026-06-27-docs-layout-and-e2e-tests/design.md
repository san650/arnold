## Context

`normalize-exercise-catalog` made the catalog the source of truth and shipped a
one-way migration (`migrate.js` + `schemaVersion`) so existing self-contained
documents would upgrade on load. This app, however, is effectively single-user
and installs fresh — there is no installed base to migrate. The migration is
therefore pure complexity. At the same time the repo is deployed to GitHub Pages
from its root (leaking planning/tooling files), and the recent rework landed
with no automated coverage.

This change removes the migration, relocates the served app into `docs/`, and
adds a small node-run Playwright e2e suite.

## Goals / Non-Goals

**Goals:**
- The normalized model is the *only* shape; the seed is authored in it.
- `docs/` contains exactly the deployable app and nothing else.
- A regression suite runnable with `node test/run.mjs`, no npm/`package.json`.
- One end-to-end test per user-facing feature; integration only.

**Non-Goals:**
- Changing the normalized data model or any catalog behavior.
- Supporting upgrade of any pre-existing document (none exist).
- Unit tests, mocking, or a test framework dependency.
- A build step or bundler — the app stays plain static files.

## Decisions

**D1 — No migration, no `schemaVersion`.** Delete `migrate.js`. `seed.js` exports
the normalized doc directly. `store.js#hydrate` loads persisted state as-is (it
is always already normalized because the seed is). `replaceDoc` stops migrating.
*Alternative:* keep `schemaVersion` as future-proofing — rejected; the user
asked for tidy and small, and we can add versioning when a second shape exists.

**D2 — Seed authored via a compact local builder.** `seed.js` defines catalog
entries once and routines reference them by a local key, with a small in-file
helper assembling `{ catalog, routines, sessions }`. Keeps the ~18 exercises
DRY and readable without a separate module. *Alternative:* hand-write every
reference with raw `catalogId`s — rejected as noisy and error-prone.

**D3 — App lives in `docs/`; references stay relative.** Every served file moves
under `docs/`. All `href`/`src` and the SW `SHELL` use `./` relative paths, so
no edits are required beyond the move. The service worker is registered with a
relative path so its scope is the `docs/`-rooted site. `CNAME` and `.nojekyll`
move into `docs/` (custom domain + Jekyll-off apply to the served site). GitHub
Pages source is set to `/docs`.

**D4 — Cucumber (Ruby) + Playwright backend.** The suite lives in `test/` as a
self-contained Cucumber project with its own `Gemfile` (`cucumber`,
`playwright-ruby-client`, `rspec-expectations`, plus `webrick` for serving).
`features/support/env.rb`:
1. starts a WEBrick static server over `docs/` on a free port (background
   thread; shut down `at_exit`);
2. connects once to a running Playwright server
   (`npx playwright run-server --port 8080 --path /ws`) via
   `Playwright.connect_to_playwright_server('ws://127.0.0.1:8080/ws')`
   (endpoint overridable with `PLAYWRIGHT_WS`), launches Chromium headless, and
   reuses the browser across scenarios (kept alive with a small thread+queue
   wrapper since the connect API is block-scoped);
3. a `Before` hook opens a fresh `BrowserContext` + page per scenario (isolated
   storage → seed is the start state); an `After` hook closes the context;
4. a small World mixin provides `open_app`, navigation, click/fill, a
   `wait_for` helper, and `app_doc` (reads the persisted document from
   IndexedDB via `page.evaluate`) for assertions; `RSpec::Expectations` supplies
   `expect`.
Steps are business-readable; selector/text mapping lives in the step
definitions. Run with `bundle exec cucumber`; non-zero exit on any failure.
The app's confirm modal is in-DOM (not a native dialog), so it is clicked like
any element. *Alternative:* a node/`playwright-cli` runner — rejected; the user
standardized on Ruby + Cucumber + Playwright.

**D5 — Each test is isolated and fresh.** Every test gets a new browser context
and clears IndexedDB before running, so the seed is the known starting state
(the fresh-install assumption this change formalizes). Tests assert on the
persisted doc (read back from IndexedDB) and/or rendered DOM.

**D6 — Feature files across the whole application.** One `.feature` per area,
covering the app end-to-end:
- `home` — routines list, progress, navigation to a workout / editor / progress.
- `workout` — view a routine, mark a set complete (progress updates), reset the
  day's checklist.
- `routines_edit` — rename, add, and delete a routine.
- `workout_edit` — add an exercise (catalog pick), edit its series, remove it.
- `catalog` — list (deduped), search/filter, open a row's detail.
- `catalog_edit` — create, rename-propagation, and cascade delete + undo.
- `catalog_pick` — picking inserts a `{ id, catalogId, series }` reference.
- `exercise_detail` — sessions/stats and the edit drawer.
- `dashboard` — heatmap + latest exercises after logging.
- `undo_redo` — a change can be undone and redone.
- `motivation` — tapping the title shows the daily quote and returns.

## Risks / Trade-offs

- **Global Playwright resolution varies by machine.** Mitigated by resolving via
  `npm root -g` and failing with a clear message if not found.
- **GitHub Pages source switch is a manual repo setting.** Documented in tasks;
  the `docs/` move and `CNAME`/`.nojekyll` placement make the repo ready for it.
- **Deleting migration is irreversible for any old doc.** Accepted per the
  fresh-install assumption — there are no old docs in play.

## Migration

None. The app assumes a fresh install; the seed is the normalized starting
state. (Removing migration code is the substance of this change.)
