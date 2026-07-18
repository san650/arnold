# Tasks — day-analytics-view

## 1. Unit normalization (foundation)

- [x] 1.1 Add `toKg(value, unit)` helper (×0.45359237, 1-decimal rounding) in `docs/app.js` next to the series helpers
- [x] 1.2 Make `seriesVolume` and `topWeightValue` unit-aware (accept the owning `unit`, convert lb→kg); update `snapTopWeight` to report converted kg for lb snapshots; audit all callers (`buildCatalog`, `renderBarChart`, `rowChartValue`, sparkline)
- [x] 1.3 In `toggleSet` snapshot construction, convert series weights with `toKg` and stamp `unit: 'kg'`; add `category` from the catalog entry
- [x] 1.4 Verify exercise definitions (catalog/routine editor) still read and write lb untouched

## 2. Day aggregation helpers

- [x] 2.1 Add `buildDayView(state, dateKey)` returning `{ groups, metrics, muscleGroups, prevTrained, nextTrained }` — sets done/planned, kg volume, exercise count from that day's sessions
- [x] 2.2 PR detection: per normalized exercise name, compare the day's top-set kg against the max over all earlier sessions; first-ever session is not a PR
- [x] 2.3 Per-routine delta: group by `snapshot.routineId`, find most recent earlier date containing that routine, compute volume delta %; omit when no prior day or no routineId
- [x] 2.4 Category resolution chain: `snapshot.category` → catalog by normalized name → `categoryOf` fallback; dedupe into muscle-group chip list
- [x] 2.5 Prev/next trained day from sorted `dayActivityMap` keys (nearest strictly before/after, independent of whether the viewed day is trained)

## 3. Route and entry points

- [x] 3.1 Extend the `dashboard` route parser with `day/:date` → `{ name: 'day', date }`; validate `YYYY-MM-DD`, bounce invalid to `#/dashboard` via `history.replaceState`
- [x] 3.2 Make past/today heatmap cells tappable buttons navigating to `#/dashboard/day/<date>`; future cells stay inert; keep 44px targets and a11y labels
- [x] 3.3 Wire the route into the render dispatch

## 4. Day view rendering

- [x] 4.1 `renderDayView(state, date)`: header with prev/next chevrons (disabled at history edges) and `fmtRelDay`-style date title
- [x] 4.2 Metric chips row: kg volume, sets done/planned, exercise count, PR count
- [x] 4.3 Muscle-group chips row
- [x] 4.4 Routine-grouped exercise list: group label from current routines with deleted-routine and no-routineId fallbacks, per-set rows (done state, weight×reps in kg or duration), PR badge, per-group delta line
- [x] 4.5 Rest-day "Descanso" empty state with working chevrons
- [x] 4.6 Styles in `docs/styles.css` following existing chip/section/list patterns

## 5. Tests and release

- [x] 5.1 Cucumber: heatmap tap opens day view; rest-day tap shows Descanso; future cell inert (extend `dashboard.feature` or new `day_view.feature`)
- [x] 5.2 Cucumber: metric values for a seeded day (volume, sets, exercises, PR badge) and per-routine delta
- [x] 5.3 Cucumber: prev/next skip rest days and disable at edges; deep link and invalid-date bounce
- [x] 5.4 Cucumber: lb exercise produces kg snapshot; legacy lb history charts/sums in kg
- [x] 5.5 Bump `docs/sw.js` cache version
- [x] 5.6 Run the full e2e suite; verify offline/standalone behavior unaffected
