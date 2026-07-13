# Tasks: series-editor-cascade

## 1. Editor behavior

- [x] 1.1 Add null-fill cascade to the `series-weight` / `series-reps`
      branches of the `data-update` change handler in docs/app.js: after
      writing `to[i]`, set the same field on every `to[j]` with `j > i` whose
      value is null; keep the single `UPDATE_SERIES` dispatch and the
      stringify no-op guard.
- [x] 1.2 Change the reps input in `renderDrawer` to `inputmode="decimal"`
      (keep `type="number"`, `step="1"`, `min="0"`).

## 2. Tests

- [x] 2.1 Add editor feature scenarios covering the delta spec: filling set 1
      of an all-null series fills the blanks below (weight only, reps stays
      null); cascade never overwrites a non-null value; cascade only flows
      downward; one undo reverts an edit plus its cascade.

## 3. Release

- [x] 3.1 Bump the service worker cache version in docs/sw.js.
- [x] 3.2 Run the test suite and verify the editor manually (uniform entry,
      pyramid entry, undo).
