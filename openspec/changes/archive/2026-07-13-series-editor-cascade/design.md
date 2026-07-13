# Design: series-editor-cascade

## Context

The series editor (`renderDrawer`, docs/app.js) renders one weight × reps row
per set. Field edits dispatch on `change` (blur) through the `data-update`
handler, which builds a `from`/`to` series pair and dispatches `UPDATE_SERIES`.
A full re-render follows; focus is restored by semantic selector
(`captureUIState`/`restoreUIState`).

Two ergonomic problems on iPhone:

1. The uniform case (same weight × reps in every set) costs 2N inputs and
   N field hops.
2. Weight inputs use `inputmode="decimal"` and reps `inputmode="numeric"` —
   different iOS keyboard layouts, so every weight→reps hop animates a
   keyboard swap (see the `pwa-gotchas` reference `keyboard-layout-switch.md`).

## Goals / Non-Goals

**Goals:**

- Uniform series entry costs one weight entry + one reps entry.
- No keyboard layout swap between weight and reps fields.
- Cascade behavior is predictable enough to state in one sentence: values flow
  into blanks, never over numbers.

**Non-Goals:**

- No help for the progression case (60/60/60 → 65/65/65) — sets below are
  non-null, so it stays one edit per row. Accepted trade for predictability.
- No "same for all sets" toggle or collapsed uniform mode (rejected
  alternative — bigger UI change for the same win).
- No `enterkeyhint` work — the iOS number pad has no return key, so it cannot
  help the target platform.
- No data-model, storage, or history changes.

## Decisions

- **Null-fill only, not match-follow.** A match-follow rule (sets that still
  equal the edited set's old value track it) would also cover progression, but
  makes propagation history-dependent and can overwrite values the user typed
  deliberately. Null-fill never touches a visible number; there is no
  contiguity clause and no stickiness state.
- **Cascade lives in the `data-update` change handler**, next to the existing
  `series-weight`/`series-reps` branches: after writing `to[i]`, walk `j > i`
  and fill nulls in the same field. The existing `from`/`to` `UPDATE_SERIES`
  dispatch already makes the whole cascade one undoable command — no reducer
  or command-shape change.
- **Feedback is the existing re-render.** The dispatch-on-blur re-render shows
  the filled rows the moment the user leaves the field; no highlight mechanism
  needed.
- **Reps inputs become `inputmode="decimal"`** (keep `type="number"`,
  `step="1"`, `min="0"`). Parsing via `numOrNull` is unchanged; a stray "12.5"
  reps was already possible via hardware keyboards and is not worth guarding.
- **Spec drift fix folded in:** the main spec says edits dispatch
  `UPDATE_EXERCISE`; the code dispatches `UPDATE_SERIES` (docs/app.js:3100).
  The delta spec's MODIFIED requirement carries the corrected name.

## Risks / Trade-offs

- [Cascade surprises a user who wanted one blank row filled differently] →
  the filled value is visible immediately on blur and editable per-row; one
  undo reverts the whole cascade.
- [Decimal keyboard permits fractional reps] → `numOrNull` stores what is
  typed; display and volume math already tolerate non-integers. No guard.
- [Cascade fires from an unchanged commit (blur without edit)] → the existing
  `JSON.stringify(from) === JSON.stringify(to)` no-op guard covers it only if
  the cascade produced no fills; a value present on set 1 with blanks below
  would re-fill on any blur of set 1. That is idempotent (same values), so no
  extra guard needed.
