## Context

Exercises stored `sets` (count), `reps` (string), and `weight` (object). Volume
couldn't be computed from a reps string, and weights couldn't vary per set. This
change replaces all of that with a structured per-set `series` array and makes
progression volume-based. The app is treated as a **fresh install** — no data
migration is written or kept.

## Goals / Non-Goals

**Goals:**
- One structured `series` array per exercise; set count = `series.length`.
- Exact volume: `Σ(weight × reps)` from numeric per-set data.
- A clean series-table editor.
- Remove all backward-compatibility / migration code.

**Non-Goals:**
- **Planned vs. actual logging** — recording the weight actually lifted per set
  (vs. the planned target). Future change `add-logged-actuals`; the `series`
  shape leaves room for it.
- **Inline mid-workout editing** — editing series from the workout screen.
  Deferred follow-up.
- **Rep ranges** — reps is a single number, not `"8-12"`. (Accepted trade-off.)
- **Mixed units within one exercise** — one `unit` per exercise.

## Decisions

**D1 — One `series` array; no separate sets/reps/weight fields.**
`reps` entry: `{ weight: number|null, reps: number|null }`; `time` entry:
`{ duration: string }`. Set count is `series.length`. A shared `unit` lives on
the exercise. *Alternative:* parallel `weights[]`/`reps[]` arrays — rejected;
one array of objects keeps a set's data together and resizes atomically.

**D2 — Numeric per-set reps.** Enables exact volume without parsing. Replaces the
old `"8-12"` string. Rep *ranges* are intentionally dropped.

**D3 — All exercise edits go through `UPDATE_EXERCISE`.** It already swaps the
whole exercise with exact from/to clones for undo. `SET_WEIGHT` (and its
per-series/legacy normalization) is removed entirely. Series weight/reps inputs,
the set-count stepper, the unit select, kind, name, video, notes all build a
`to` clone and dispatch `UPDATE_EXERCISE`.

**D4 — Progression metric = total session volume.** `reps`: `Σ(weight × reps)`
over the snapshot's series; `time`: leading number of the duration. The snapshot
stores `{ name, kind, routineId, unit, series }`, so volume is derived from
history with no extra schema.

**D5 — No backward compatibility.** Remove: legacy `boolean[]` session-entry
handling (`sessionFor`/`sessionSnapshot`/`entryOf`), the bare-weight
`normWeightState` path, and every `?? legacy` shim for the old fields. Fresh
install assumed; no import-time migration.

**D6 — Catalog-edit drawer trimmed to definition fields.** Because routine
params now live in per-instance `series`, the catalog-edit drawer edits only
name/video/notes (definition fields). Per-instance series are edited in the
workout editor. This aligns with the catalog change's "definitions hold identity
only" decision.

## Risks / Trade-offs

- **Dropping rep ranges** loses the `"8-12"` expressiveness → Accepted; numeric
  reps are required for exact volume. Users pick a target number.
- **No migration** means any pre-existing local data is invalid → Accepted per
  the fresh-install directive; covered by `reset()` to seed.
- **Volume axis units** (kg·reps) are not a clean unit → the chart shows the
  number; the weight unit is shown only on the per-set/weight labels.

## Open Questions

- Should the series table offer a "fill down" affordance (apply row 1 to all) to
  reduce typing for uniform sets? Deferred; not required for first cut.
