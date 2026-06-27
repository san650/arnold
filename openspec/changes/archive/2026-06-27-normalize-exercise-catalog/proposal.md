## Why

Today the "catalog" is not stored — it is derived. The seed ships
`catalog: []`, and `buildCatalog` assembles the list at render time by unioning
routine exercise instances, orphan `doc.catalog` definitions, and session
history, de-duplicated by normalized name. Every exercise a user trains "exists
only as a routine instance"; each routine instance carries its own copy of
`name`/`kind`/`video`/`notes`. Keeping those copies in sync requires bulk
fan-out commands (`CATALOG_RENAME`, `CATALOG_UPDATE_FIELD`), and an exercise can
only be deleted when no routine uses it — so you cannot actually remove an
exercise you train.

Three things follow from this: there's no real home for the catalog (it lives in
two drawers hung off a kebab menu), editing is needlessly complex, and **delete
is blocked exactly when you'd want it**.

This change promotes the catalog to the source of truth: one definition per
exercise, referenced by routines. Editing becomes edit-once, deletion cascades
to the routines that use it, and the catalog gets its own screen with a
view/edit mode like the rest of the app.

## What Changes

- **Model normalization (Model A).** `catalog` becomes the canonical store of
  exercise definitions `{ id, name, kind, video, notes, unit }`, unique by
  normalized name. A `routine.exercise` becomes a reference plus per-instance
  training params: `{ catalogId, series }`. A `hydrateExercise(state, instance)`
  resolver merges the two at the read boundary so render code stays readable.
- **Migration in place.** On first load of the new version, a one-way migration
  walks routines, builds catalog entries (deduped by normalized name,
  first-non-empty wins on divergent `notes`/`video`), rewrites instances to
  `{ catalogId, series }`, folds in existing `doc.catalog` orphans, and stamps a
  `schemaVersion`. Users are expected to Export beforehand (existing action).
- **Command rewrite.** Remove `CATALOG_RENAME` and `CATALOG_UPDATE_FIELD`
  (no more bulk sync). Split `UPDATE_EXERCISE` into `UPDATE_CATALOG_ENTRY`
  (definition fields, with reshape-on-`kind`-change across referencing
  instances) and `UPDATE_SERIES` (per-instance sets). `ADD_EXERCISE` inserts a
  `{ catalogId, series }` reference. `CATALOG_DELETE` always cascades:
  it removes every reference from every routine (sessions preserved as history).
- **Catalog screen.** Replace the manager/picker drawers with a `#/catalog`
  screen. **View mode** navigates the list (tap → `#/catalog/ex/<slug>` detail).
  **Edit mode** (`#/catalog/edit`, entered via an Editar button like `#/edit`)
  adds, edits, and deletes exercises. A **pick mode** (`#/catalog/pick/<routineId>`,
  reached from the workout-edit FAB) selects an exercise to insert into a routine
  and returns. The create form and per-entry edit stay as drawers launched from
  the screen.
- **Cascade delete UX.** Deleting an in-use exercise is allowed; the confirm
  modal enumerates the affected days ("Se quitará de Día 02, Día 05") and notes
  that logged sessions are kept. Undo restores the catalog entry and every
  routine reference.

## Capabilities

### Modified Capabilities
- `exercise-catalog`: the catalog becomes the source of truth (definitions
  referenced by routines, not derived from them); gains a dedicated screen with
  view/edit modes; deletion cascades to routines instead of being blocked.

## Impact

- `app.js` — `hydrateExercise` resolver; `buildCatalog` reads `doc.catalog`
  directly; `renderCatalog` screen (view/edit/pick modes) replacing the manager
  and picker drawers; `parseRoute` learns `catalog`, `catalog/edit`,
  `catalog/pick/<id>`, `catalog/ex/<slug>[/edit]`; kebab entry and workout FAB
  become `data-go` links; exercise-detail back target respects origin; every
  read of `ex.name`/`kind`/`video`/`notes`/`unit` routes through the resolver.
- `commands.js` — remove `CATALOG_RENAME`/`CATALOG_UPDATE_FIELD`; add
  `UPDATE_CATALOG_ENTRY` and `UPDATE_SERIES`; `ADD_EXERCISE` carries a ref;
  `CATALOG_DELETE` always builds cascade `targets`.
- `store.js` / `db.js` — `schemaVersion` + one-way migration on hydrate.
- `seed.js` — seed ships a populated `catalog` and routines as references.
- `styles.css` — catalog screen list/rows, edit-mode affordances (add FAB,
  per-row edit/delete), view-mode rows.
- Persisted document is rewritten one-way (migration); pre-migration Export is
  the recovery path.
