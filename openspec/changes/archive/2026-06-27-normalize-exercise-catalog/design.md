## Context

The `add-exercise-catalog` change introduced a `catalog` array, but as a
side-channel for *orphan* definitions — exercises created but not yet in a
routine. The user-facing catalog stayed derived: `buildCatalog` unions routine
instances, orphans, and session history, deduped by normalized name. Each
routine exercise is a self-contained object (`{ id, name, kind, unit, series,
video, notes }`), so the same exercise in two routines is two independent
copies. Bulk commands (`CATALOG_RENAME`, `CATALOG_UPDATE_FIELD`) exist solely to
keep those copies in sync, and deletion is gated to unused exercises because a
used one has live copies that the catalog can't safely remove.

This change inverts the ownership: the catalog becomes the single definition,
and routines hold references. The original feature request — a catalog screen
with full CRUD, where deleting an exercise also removes it from routines — falls
out of that model nearly for free.

## Goals / Non-Goals

**Goals:**
- `catalog` is the canonical, stored set of exercise definitions, unique by
  normalized name.
- A routine exercise is a reference + per-instance training params.
- One definition edit propagates everywhere; delete cascades to routines;
  sessions (history) are never rewritten.
- A dedicated `#/catalog` screen with a view mode (navigate) and an edit mode
  (add/edit/delete), matching the `#/edit` routines pattern.

**Non-Goals:**
- Cross-device/shared exercise libraries — the catalog stays local to the doc.
- Rewriting historical session snapshots — they remain frozen copies.
- A separate per-routine override of definition fields (name/video/notes) —
  Model A makes those shared by design.

## Decisions

**D1 — Catalog is the source of truth; routines reference it (Model A).**
`catalog: [{ id, name, kind, video, notes, unit }]`. `routine.exercises:
[{ catalogId, series }]`. *Alternative (Model B):* keep instance copies and an
"ensure entry exists" invariant — rejected; it preserves the redundancy and the
bulk-sync commands this change exists to delete.

**D2 — Identity is normalized name; duplicates merge.** The catalog is unique by
normalized name. Two routine exercises with the same name (e.g. the seed's two
"Sentadilla con barra" with different notes) collapse to one entry. *Alternative:*
identity by id, allowing same-name entries — rejected by product call; one name =
one exercise.

**D3 — `unit` is a definition field.** You don't bench in kg in one routine and
lb in another; `unit` moves onto the catalog entry. `series` (weights/reps/
duration per set) stays per-instance.

**D4 — Read through a resolver.** `hydrateExercise(state, instance)` returns
`{ ...catalogEntry, series: instance.series, catalogId }`. Render code
(`renderWorkout`, `renderDrawer`, history, dashboard) reads the hydrated view, so
most of it keeps its current shape despite the model change.

**D5 — Command set collapses.** Remove `CATALOG_RENAME` and
`CATALOG_UPDATE_FIELD` (the bulk-sync subsystem). `UPDATE_EXERCISE` splits into
`UPDATE_CATALOG_ENTRY` (name/kind/video/notes/unit on the definition) and
`UPDATE_SERIES` (per-instance sets). All remain undoable via from/to clones.

**D6 — Two cascades are explicit operations.**
- *Delete:* `CATALOG_DELETE` always builds `targets` from live routines
  (iterate routines, match `normalizeName`, capture index + clone), removes
  every reference, and removes the entry. Sessions untouched. Undo re-inserts
  references and entry exactly (machinery already present).
- *Kind change:* changing `kind` (reps↔time) on an entry reshapes the `series`
  of every referencing instance via the existing `reshapeSeries`. The command
  captures per-instance from/to series so undo is exact.

**D7 — Migration is one-way, in place.** On hydrate, if the doc has no
`schemaVersion`: walk routines → dedup by normalized name → build catalog
entries (first non-empty wins on divergent `notes`/`video`/`unit`) → rewrite
each instance to `{ catalogId, series }` → fold in existing `doc.catalog`
orphans → stamp `schemaVersion = 2`. No automatic backup; the existing Export
action is the recovery path. *Alternative:* auto-export a backup first —
rejected by product call (keep it simple).

**D8 — Catalog screen, view/edit modes mirror `#/edit`.**
- `#/catalog` — view mode: navigable list, tap row → `#/catalog/ex/<slug>`.
- `#/catalog/edit` — edit mode (entered via an "Editar" button): add (FAB →
  create-form drawer), edit (row → edit drawer), delete (per-row affordance →
  cascade confirm).
- `#/catalog/pick/<routineId>` — pick mode from the workout-edit FAB: tap row →
  `ADD_EXERCISE` ref into the routine → back to `#/workout/<id>/edit`; "create
  new" → create entry + ref → its instance edit.
- `#/catalog/ex/<slug>[/edit]` — exercise detail (reuses `renderExerciseDetail`),
  with the edit drawer; back returns to `#/catalog`.

The manager (`catalogManagerOpen`) and picker (`catalogPickerOpen`) drawer state
is retired; the kebab "Catálogo" item and the workout FAB become `data-go`
links.

**D9 — Detail screen learns its origin.** `renderExerciseDetail` is reused for
`#/catalog/ex/...` and `#/dashboard/ex/...`; the route carries the origin so the
back button returns to the right screen.

## Risks / Trade-offs

- **One-way migration over real user data.** Mitigated by Export and a careful,
  idempotent migration guarded by `schemaVersion`. A wrong migration is the main
  risk; verify against a copy of a real doc before release.
- **Broad read-path edit.** Every `ex.name`/`kind`/`video`/`notes`/`unit` read
  must route through `hydrateExercise`. Mitigated by centralizing in one
  resolver and grepping for raw field access.
- **Merging the squat loses a note.** Accepted (D2): the Día-5 squat's distinct
  note is folded away by first-non-empty-wins.
- **Session history diverges from a renamed catalog.** Snapshots keep the old
  name, so renaming an exercise leaves past sessions under the prior name in
  history. Accepted — snapshots are point-in-time records.

## Migration

1. On hydrate, detect absent `schemaVersion`.
2. Build catalog: for each routine exercise in order, `normalizeName`; create an
   entry if new (`id`, `name`, `kind`, `unit`, first-non-empty `video`/`notes`),
   else leave the existing entry (first wins).
3. Rewrite each `routine.exercise` to `{ catalogId, series }`.
4. Fold `doc.catalog` orphans into the catalog (same dedup), drop ones already
   present.
5. Set `doc.schemaVersion = 2`; persist.
6. History/undo is cleared across the migration boundary (the pre-migration undo
   stack references the old shape).
