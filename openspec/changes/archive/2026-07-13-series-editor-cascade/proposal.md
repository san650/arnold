# Proposal: series-editor-cascade

## Why

Entering weight × reps in the series editor charges the uniform case (same
values in every set, ~90% of edits) the full per-series price: 2N inputs and
N field hops, with the iOS keyboard flickering between hops because the weight
and reps fields use different `inputmode` layouts. Filling in blanks should
cost one entry per column, and hopping between fields should not swap the
keyboard.

## What Changes

- **Null-fill cascade in the series editor**: committing a weight (or reps)
  value on set *i* propagates that value into the same field of every set
  below *i* whose value is null. Non-null values are never overwritten; weight
  and reps cascade independently; the cascade never flows upward. One
  `UPDATE_SERIES` command carries the whole change, so a single undo reverts
  the cascade.
- **Uniform keyboard layout**: reps inputs switch from `inputmode="numeric"`
  to `inputmode="decimal"` so weight→reps hops keep the same iOS keyboard
  layout. Presentation-only; no spec change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `per-series-weights`: the "Series-table editor" requirement gains the
  null-fill cascade behavior — new scenarios for fill-into-blanks,
  never-overwrite, and per-field independence.

## Impact

- `docs/app.js`: the `data-update` change handler for `series-weight` /
  `series-reps` (cascade), and the reps `<input>` markup in `renderDrawer`
  (`inputmode`).
- `docs/sw.js`: cache version bump (release requirement).
- `test/features/`: editor scenarios covering the cascade rule.
- No data-model, storage, or history changes — `series` shape is untouched.
