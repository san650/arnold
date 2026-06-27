## 1. Model & migration

- [x] 1.1 Define the normalized shape: `catalog` entries
      `{ id, name, kind, video, notes, unit }` (unique by normalized name);
      `routine.exercise` = `{ catalogId, series }`
- [x] 1.2 Add `hydrateExercise(state, instance)` resolver merging entry + series
- [x] 1.3 Add `schemaVersion` to the doc; one-way migration on hydrate in
      `store.js` (dedup by normalized name, first-non-empty wins, rewrite
      instances to refs, fold orphans, clear undo history across the boundary)
- [x] 1.4 Update `seed.js` to ship a populated `catalog` and routines as refs
- [x] 1.5 Rewrite `buildCatalog` to read `doc.catalog` as the source of truth
      (keep session-history aggregation for stats/usage metadata)

## 2. Commands

- [x] 2.1 Remove `CATALOG_RENAME` and `CATALOG_UPDATE_FIELD`
- [x] 2.2 Add `UPDATE_CATALOG_ENTRY` (name/kind/video/notes/unit; on `kind`
      change, reshape `series` of every referencing instance, from/to captured)
- [x] 2.3 Add `UPDATE_SERIES` (per-instance sets edit, undoable via from/to)
- [x] 2.4 Change `ADD_EXERCISE` to insert a `{ catalogId, series }` reference
- [x] 2.5 Make `CATALOG_DELETE` always cascade: build `targets` from live
      routines, remove every reference + the entry, preserve sessions, exact undo
- [x] 2.6 Update the action-log (`logLine`) strings for the new/changed commands

## 3. Catalog screen — routing & shell

- [x] 3.1 `parseRoute`: add `catalog`, `catalog/edit`, `catalog/pick/<routineId>`,
      `catalog/ex/<slug>[/edit]`; add origin flag to the `exercise` route
- [x] 3.2 `render` dispatch: route `#/catalog*` to `renderCatalog(state, mode)`
- [x] 3.3 Retire `catalogManagerOpen` / `catalogPickerOpen` drawer state and its
      open/close/hashchange handling

## 4. Catalog screen — view & edit modes

- [x] 4.1 `renderCatalog` view mode: navigable list, filter, row → detail;
      "Editar" button enters edit mode (mirrors `#/edit`)
- [x] 4.2 Edit mode: add FAB → create-form drawer; per-row edit → edit drawer;
      per-row delete → cascade confirm; "Listo" returns to view mode
- [x] 4.3 Reuse the create-form drawer (`ADD_CATALOG_EXERCISE`) and the
      entry-edit drawer (`UPDATE_CATALOG_ENTRY`), launched from the screen
- [x] 4.4 Kebab "Catálogo" item → `data-go="#/catalog"` (drop the drawer)

## 5. Pick mode & detail

- [x] 5.1 Workout-edit FAB → `data-go="#/catalog/pick/<routineId>"`
- [x] 5.2 Pick mode: tap row → `ADD_EXERCISE` ref → back to
      `#/workout/<id>/edit`; "create new" → entry + ref → instance edit
- [x] 5.3 `renderExerciseDetail` honors origin (catalog vs dashboard) for its
      back target; `#/catalog/ex/<slug>[/edit]` reuses it + the edit drawer

## 6. Cascade delete UX

- [x] 6.1 Remove the delete gates (UI `deletable` + handler `usedIn.length` /
      `catIdx` bail-out)
- [x] 6.2 Confirm modal enumerates affected days ("Se quitará de Día 02, Día 05")
      and states that logged sessions are kept
- [x] 6.3 Verify undo restores the entry + every routine reference at position

## 7. Styles

- [x] 7.1 Catalog screen list/rows, view-mode vs edit-mode affordances
      (add FAB, per-row edit/delete) in `styles.css`

## 8. Verification

- [x] 8.1 Migrate a copy of a real persisted doc; confirm routines render
      identically and the catalog lists every exercise once
- [x] 8.2 Edit a definition (name/video/notes) → all routines reflect it;
      change `kind` → referencing instances reshape; undo each exactly
- [x] 8.3 Delete an in-use exercise → removed from its routines, sessions kept,
      confirm lists the right days, undo restores everything
- [x] 8.4 Pick flow: add from catalog and create-new both land in the routine
      and return correctly
