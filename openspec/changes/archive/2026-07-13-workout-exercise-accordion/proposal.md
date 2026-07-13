# Workout Exercise Accordion

## Why

On the workout screen every exercise card renders fully expanded — name, notes,
chips, all set rows, and media panel. With 5–8 exercises per routine the list
is long, the current exercise is easy to lose while scrolling, and most visible
content is irrelevant to the set being performed. Collapsing everything except
the exercise in progress keeps focus on the active work.

## What Changes

- Exercise cards on the workout screen become an accordion: at most one card is
  expanded at a time.
- Collapsed cards show name, notes, and stat chips only; set rows and the media
  panel are hidden.
- On entering the workout screen, the first incomplete exercise starts
  expanded; if all exercises are complete (or none exist), all start collapsed.
- Tapping a collapsed card expands it and collapses the previously expanded
  one; tapping the expanded card's header collapses it. No auto-advance on
  completing the last set — the user moves on manually (they may want to adjust
  weights or uncheck a serie first).
- Edit mode (reorder/edit/remove) renders all cards collapsed with no expansion
  mechanism.
- Expansion state is transient (in-memory scalar), reset on navigation.
- Completed exercises keep the existing orange border highlight
  (`.exercise.complete`) in both states.

## Capabilities

### New Capabilities

- `workout-accordion`: expansion/collapse behavior of exercise cards on the
  workout screen — single-expansion invariant, collapsed card content, initial
  expansion rule, tap interactions, edit-mode behavior, and state transience.

### Modified Capabilities

<!-- none — per-series data model, catalog, and chart requirements are unchanged -->

## Impact

- `docs/app.js`: `renderWorkout` (card markup gains collapsed/expanded
  variants), transient `ui` state (new `expandedExercise` scalar +
  `resetTransient`), tap-action delegation (new expand/collapse action).
- `docs/styles.css`: collapsed-card styles; existing `.exercise.complete`
  border unchanged.
- `docs/sw.js`: cache version bump (PWA release requirement).
- `test/features`: e2e coverage for accordion behavior. Existing step
  "I mark the first set complete" remains valid because the first incomplete
  exercise starts expanded.
- No data-model or storage changes.
