## Context

Today the only "catalog" is derived: `buildCatalog` scans routine exercises and
session history to list what you've trained. There's no way to define an
exercise that isn't already in a routine, and no UI to manage the set. This
change adds first-class standalone definitions and a manager, while keeping the
derived view as the unifying list.

## Goals / Non-Goals

**Goals:**
- A standalone `catalog` of exercise *definitions* (name, kind, video, notes).
- One merged, de-duplicated list (routine instances + standalone defs) by
  normalized name.
- Create, browse/filter, open, and delete (when unused) from one drawer.
- Definition-level edits (name/kind/video/notes) stay in sync across the
  standalone def and every routine instance.

**Non-Goals:**
- Routine parameters (sets/reps/duration/weight) on catalog definitions — those
  belong to the routine instance, set when the exercise is added to a routine.
- A shared exercise library across devices/users — catalog is local to the doc.

## Decisions

**D1 — Definitions hold identity only, not routine params.**
A catalog entry is `{ id, name, kind, video, notes }`. Sets/reps/weight are
configured on the routine instance. *Alternative:* store full defaults on the
definition — rejected; it duplicates and drifts from routine-specific values.

**D2 — `buildCatalog` merges standalone defs into the derived list, deduped by
normalized name.** A standalone def that shares a name with a routine exercise
does not create a duplicate row (`touch` dedups). This keeps one list regardless
of where an exercise "lives".

**D3 — Only unused definitions are deletable.** An exercise used by any routine
cannot be deleted from the catalog; the UI explains "remove it from routines
first". `CATALOG_DELETE` carries a `catalogTarget` (id + index + full entry) so
undo restores it exactly.

**D4 — Definition-level edits sync via `catalogTarget`.** `CATALOG_RENAME` and
`CATALOG_UPDATE_FIELD` carry an optional `catalogTarget` so the standalone def
updates alongside routine instances. Only definition fields
(`kind`, `video`, `notes`, `name`) sync; routine-only fields don't.

**D5 — Drawer back-stack.** The create form opens from the manager; cancelling
or saving returns to the manager (`catalogManagerOpen`/`catalogFormOpen` swap),
and a hashchange closes both.

## Risks / Trade-offs

- **Two sources for the same exercise** (routine instance + standalone def) →
  Mitigation: normalized-name dedup in `buildCatalog`; sync commands keep
  definition fields consistent.
- **Deleting a def vs. removing from routines** are different operations that can
  confuse → Mitigation: delete is gated to unused defs with an explanatory note.

## Open Questions

- Should creating a routine exercise also create/link a standalone def
  automatically, or stay manual? Currently manual.
