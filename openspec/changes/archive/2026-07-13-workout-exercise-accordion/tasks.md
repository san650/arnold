# Tasks: workout-exercise-accordion

## 1. State

- [x] 1.1 Add `expandedExercise: undefined` to `UI_DEFAULTS` in `docs/app.js`
      (undefined = uninitialized → apply entry rule; null = all collapsed;
      string = expanded exercise id). Verify `resetTransient()` clears it.
- [x] 1.2 Add `expand-exercise` / `collapse-exercise` handlers to the
      delegated action map (set `ui.expandedExercise` to id / null, re-render).

## 2. Rendering

- [x] 2.1 In `renderWorkout`, resolve the effective expanded id: if
      `ui.expandedExercise === undefined`, compute first exercise whose
      `doneCount < setCount` (or null when none); store the resolution so a
      set-toggle re-render doesn't re-run the entry rule.
- [x] 2.2 Render collapsed variant (normal mode): name, notes, stat chips only;
      omit `.sets` and the media panel; whole card is the expand tap target
      with `data-action="expand-exercise"`, `aria-expanded="false"`, and an
      aria-label naming the exercise.
- [x] 2.3 Render expanded variant: current full card plus
      `data-action="collapse-exercise"` on `.ex-head` and
      `aria-expanded="true"`.
- [x] 2.4 Edit mode: render all cards collapsed, without expand/collapse
      actions; keep drag handle, edit, and remove buttons working.
- [x] 2.5 Confirm `.exercise.complete` (orange border) applies in both
      collapsed and expanded variants (no CSS change expected).

## 3. Styles

- [x] 3.1 Add collapsed-card styles in `docs/styles.css` (tap-target cursor,
      spacing when sets/media are absent); reuse existing card tokens.

## 4. Tests

- [x] 4.1 Add cucumber scenarios: initial expansion on first incomplete
      exercise; expanding B collapses A; collapsing the expanded card;
      collapsed card has no set toggles; completed collapsed card re-expands;
      edit mode all collapsed; state resets on navigation.
- [x] 4.2 Add step definitions for expand/collapse taps and
      expanded/collapsed assertions (use `aria-expanded` +
      `data-test="exercise-card"`).
- [x] 4.3 Audit existing feature files for set taps on non-first exercises;
      update to expand first where needed. Run the full e2e suite.

## 5. Release

- [x] 5.1 Bump the service-worker cache version in `docs/sw.js`.
- [x] 5.2 Manual verification on iPhone-size viewport: entry state, tap
      targets, completed-card highlight, media panel restore on re-expand.
