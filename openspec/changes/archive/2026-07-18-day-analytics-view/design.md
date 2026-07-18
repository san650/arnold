# Design — Day Analytics View

## Context

Sessions are stored as `doc.sessions[dateKey][exerciseInstanceId] = { sets: boolean[], snapshot }`, where `snapshot = { name, kind, unit, series, routineId }` is frozen when a set is toggled (`docs/commands.js`). All history reads go through `sessionFor` / `sessionSnapshot` and the series helpers (`seriesVolume`, `topWeightValue`, `snapTopWeight`, `seriesDuration`) in `docs/app.js`. The heatmap (`renderHeatmap`) already emits `data-date="YYYY-MM-DD"` on each cell and its squares were sized to the 44px tap minimum in anticipation of this feature. Routing is a hash parser (`routeParsers`), rendering is full re-render on state/route change, and events are delegated by `data-*` attributes.

Constraints:

- Vanilla-stack PWA, no dependencies, single `app.js`.
- No timestamps in session data → session duration is not derivable; explicitly excluded.
- `unit` is per exercise (`kg`|`lb`); day-level sums must not add raw lb to kg.
- Snapshots lack `category`; muscle groups must be resolved indirectly for old data.
- Full re-render on hash change means the day view is pure: `(state, date) → html`.

## Goals / Non-Goals

**Goals:**

- One tap from heatmap cell to a readable "what did I do that day" page.
- Day metrics that support progressive overload decisions: kg volume, set adherence, PR count, per-routine delta vs. last time.
- Make kg the canonical unit of *history* while leaving exercise definitions free to use lb.

**Non-Goals:**

- Session duration / time-under-tension (no data).
- Estimated 1RM, rep-PRs, weekly/monthly aggregate views.
- Editing history from the day view — it is read-only.
- Migrating stored lb snapshots in place.

## Decisions

### D1 — Route `#/dashboard/day/:date`, extend the `dashboard` parser

`dashboard: (p) => p[1] === 'day' && p[2] ? { name: 'day', date: p[2] } : …`. Date validated against `/^\d{4}-\d{2}-\d{2}$/`; invalid → `history.replaceState` bounce to `#/dashboard`, same pattern as unknown exercise slugs. Alternative — a query param or UI state field — rejected: deep-linkable hash routes are the app's navigation idiom and survive refresh.

### D2 — Heatmap tap opens any non-future day

Delegated click on `.heatmap-cell[data-date]` (cells become `<button>`s for a11y). Future cells stay inert. Rest days open the view with a "Descanso" state rather than doing nothing — a dead tap reads as a bug.

### D3 — Chevrons navigate trained days only

Prev/next computed from the sorted keys of `dayActivityMap(state)`: previous = greatest trained key `<` current, next = smallest trained key `>` current (whether or not the current day itself is trained). A missing neighbor disables the chevron. Rationale: browsing history is dense (rest days carry no content); sparse calendar stepping was rejected in exploration. Any day remains reachable via the heatmap, so the two entry modes compose.

### D4 — Weight normalization: convert at snapshot-write, guard at read

- New helper `toKg(value, unit)` (`lb → value × 0.45359237`, rounded to 1 decimal).
- **Write**: when building a session snapshot, convert each `series[i].weight` with `toKg` and stamp `unit: 'kg'`. Exercise definitions (catalog/routine `series` + `unit`) are untouched.
- **Read**: `seriesVolume`, `topWeightValue` take the owning `unit` into account (or a wrapper converts before they run) so legacy lb snapshots compute in kg. `snapTopWeight` reports converted `{ value, unit: 'kg' }` for lb snapshots.
- Alternative — one-time migration rewriting stored snapshots — rejected: rewriting user history is riskier than a 4-line read guard, and imports of old exports would need the guard anyway.
- Consequence accepted: for a lb-unit exercise, new history rows display kg while the editor shows lb.

### D5 — Snapshot gains `category`

Snapshot construction adds `category` from the catalog entry. Day-view resolution order: `snapshot.category` → catalog lookup by normalized name → existing `categoryOf` keyword fallback. Chips deduplicate categories across the day's exercises with at least one done set.

### D6 — PR = strict top-set kg record

For each exercise (normalized name) with done sets on day `D`: PR iff `topKg(D) > max(topKg(d) for all trained d < D)` over `buildExerciseHistory`. First-ever session of an exercise is **not** a PR (nothing beaten). All comparisons in kg via D4. Header chip shows the count; each PR exercise row gets a `▲ PR` badge.

### D7 — Delta is per routine group, not per day

Exercises grouped by `snapshot.routineId` (label resolved from current routines, falling back to "Rutina eliminada"; missing `routineId` groups under "Otros" with no delta). For each group: find the most recent earlier date whose sessions include that `routineId`, sum kg volume of that routine's exercises on both dates, show `vs. <fecha> ±N%`. Day-level delta rejected: ill-defined when the day mixes routines or composition changes.

### D8 — Aggregation is one pure helper

`buildDayView(state, dateKey)` returns `{ groups, metrics, muscleGroups, prevTrained, nextTrained }` computed in a single pass over `doc.sessions` plus one `buildExerciseHistory`-style scan for PR baselines. Render stays dumb. Dataset is small (bounded sessions object), so O(days × exercises) per render is fine — matches how `buildCatalog` already works.

## Risks / Trade-offs

- [Legacy lb snapshot displayed raw in existing exercise-detail rows] → `fmtSeriesWeights` continues to show stored value+unit (correct as stored); only *computed* metrics are normalized. No user-visible lie.
- [Rounding drift: lb→kg at 1 decimal loses exactness] → acceptable; 0.05 kg precision is below plate resolution. PR comparison uses the same rounding on both sides.
- [`categoryOf` keyword guess mislabels an old exercise] → chips only; no metric depends on category. Wrong chip is cosmetic and self-heals as new snapshots carry `category`.
- [Routine renamed/deleted since the session] → group label falls back gracefully; delta still works because matching is by `routineId`, not name.
- [Forgot SW cache bump] → task includes the bump; CI guard already covers it.

## Migration Plan

No data migration. New snapshots are kg+category from first deploy; old snapshots are handled at read time indefinitely. Rollback = revert commit; stored data remains readable by the old code (extra `category` field is ignored, kg snapshots are just kg-unit sessions).

## Open Questions

None — exploration resolved navigation semantics, unit policy, delta semantics, and PR definition.
