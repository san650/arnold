## Why

A single weight + a free-text `reps` string per exercise doesn't match how
people actually lift. Ramping/pyramid sets (60×12, 70×10, 80×8) are common, and
the app can't express them — nor can it compute real training volume from a reps
string like `"8-12"`. We want each set to carry its own weight and reps, and
progression to reflect total work (volume).

## What Changes

- **Replace** the per-exercise `sets` (count) + `reps` (string) + `weight`
  (object) + uncommitted `weights` (array) with a single structured `series`
  array. For `reps` exercises each entry is `{ weight: number|null, reps:
  number|null }`; for `time` exercises each entry is `{ duration: string }`. The
  number of sets is `series.length`. A shared `unit` (`kg`/`lb`) lives on the
  exercise.
- The exercise editor becomes a **series table**: one row per set with weight
  and reps inputs, plus a set-count stepper and a unit selector.
- The workout view shows each set's `weight × reps` target beneath its button.
- Session snapshots store the full `series` (+ `unit`), so history and the
  session list show per-series values and exact volume.
- **Progression chart plots total session volume** — `Σ(weight × reps)` — for
  `reps` exercises (duration for `time`).
- **BREAKING / no backward compatibility:** the app assumes a fresh install. All
  migration and legacy-shape handling is removed — legacy `boolean[]` session
  entries, the bare-`{value,unit}` `SET_WEIGHT` payload path, and the
  `weight`/`reps`/`sets` fields. The `SET_WEIGHT` command is removed; all
  exercise edits flow through `UPDATE_EXERCISE`.

## Capabilities

### New Capabilities
- `per-series-weights`: the structured `series` model, the series-table editor,
  workout/history display, and persistence.
- `progression-chart`: the per-exercise chart, defined to plot total volume.

### Modified Capabilities
<!-- No existing specs yet; everything here is new. -->

## Impact

- `seed.js` — exercises rebuilt in the `series` shape.
- `commands.js` — remove `SET_WEIGHT` + `normWeightState`; drop legacy
  `entryOf` branch; `UPDATE_EXERCISE` carries all exercise edits.
- `app.js` — model helpers, editor drawer, workout render, snapshot, chart,
  sparkline, catalog builders, and the catalog-edit drawer (trimmed to
  definition fields, since routine params now live in `series`).
- `styles.css` — series-table layout.
- Persisted document shape changes with no migration (fresh install assumed).
