## Why

Exercises only exist as instances inside routines. To reuse an exercise you have
to already have it in a routine, and there's no place to browse, create, or
clean up the set of exercises you train. A standalone exercise catalog gives a
single home for exercise *definitions* (name, type, image/video, notes),
independent of which routines use them.

## What Changes

- Add a `catalog` array to the document holding standalone exercise definitions
  (name, kind, video, notes only — no routine params like sets/reps/weight).
- Add an **exercise-catalog manager** drawer, opened from the kebab menu:
  browse every exercise (routine instances + standalone defs, de-duplicated by
  normalized name), filter by name, open an exercise's detail/stats, create new
  definitions, and delete definitions not used by any routine.
- Add a **create-exercise form** drawer with "save & keep adding" and
  "save & close" actions.
- New `ADD_CATALOG_EXERCISE` command; extend `CATALOG_RENAME`,
  `CATALOG_UPDATE_FIELD`, and `CATALOG_DELETE` to keep a standalone definition in
  sync with (and removable alongside) its routine instances.
- Building a routine exercise from a standalone definition fills in sensible
  routine defaults (e.g. reps `8-12` for reps exercises).

## Capabilities

### New Capabilities
- `exercise-catalog`: the standalone catalog of exercise definitions, its
  manager/create UI, and the commands that create, edit, sync, and delete
  definitions.

### Modified Capabilities
<!-- No existing specs yet; everything here is new. -->

## Impact

- `app.js` — catalog manager + create-form drawers, `buildCatalog` merges
  standalone defs, delete/sync logic, kebab-menu entry, drawer/back-stack state.
- `commands.js` — `ADD_CATALOG_EXERCISE`; `catalogTarget` handling in
  `CATALOG_RENAME` / `CATALOG_UPDATE_FIELD` / `CATALOG_DELETE`.
- `seed.js` — seed doc gains `catalog: []`.
- `styles.css` — manager rows, delete affordance, create-form layout.
- Persisted document gains a `catalog` array (additive, backward compatible).
