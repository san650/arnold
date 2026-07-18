# Day Analytics View

## Why

The heatmap shows *that* you trained but not *what* you did — reading a past day requires drilling into each exercise's detail screen one at a time. The heatmap cells were already sized for tapping ("days become tappable later"); this change delivers that tap: a per-day view with the metrics a lifter actually uses (volume, sets, PRs, muscle groups, progression vs. the previous same-routine day).

## What Changes

- Tapping a heatmap cell opens a new day view at `#/dashboard/day/:date`.
- Day view header: prev/next chevrons that navigate to the **adjacent trained day** (rest days are skipped by the chevrons, but any day is reachable via heatmap tap).
- Metric chips: total volume (kg), sets done/planned, exercise count, PR count.
- Muscle-group chips for the categories trained that day.
- Exercise list grouped by routine, with per-set detail (weight×reps or duration, done state) and a PR badge on exercises whose top set exceeds all prior history.
- Per-routine-group volume delta vs. the most recent earlier day that same routine was trained.
- Rest days (no completed sets) render a "Descanso" empty state; chevrons still work.
- History weights become canonically kg: new session snapshots convert lb→kg at write time, and volume/top-weight helpers gain a read-time lb→kg guard for legacy snapshots. Exercise definitions keep their `lb` unit option — only the frozen history copy is normalized.
- New session snapshots also record the exercise `category` so the day view survives later catalog deletions; older snapshots resolve category via catalog lookup by name, then the existing `categoryOf` keyword fallback.
- Explicitly out of scope: session duration (no timestamps are captured), estimated 1RM, rep-PRs.

## Capabilities

### New Capabilities

- `day-analytics`: the per-day view — route, heatmap tap entry, trained-day prev/next navigation, day metrics (volume, sets, exercises, PRs), muscle-group chips, routine-grouped exercise list with per-set detail, per-routine volume delta, rest-day state.
- `session-snapshots`: content requirements for frozen session snapshots — kg-normalized weights with `unit: 'kg'` at write time, `category` recorded, and read-time lb→kg guarding when computing volume/top-weight from legacy snapshots.

### Modified Capabilities

- `progression-chart`: the "Progression measured by total volume" requirement changes to volume measured in kg regardless of a snapshot's stored unit (lb sessions convert at read time), so mixed-unit histories chart on one scale.

## Impact

- `docs/app.js`: route parser (`dashboard` branch), heatmap cell click wiring, new `renderDayView`, new day-aggregation helpers, `toKg` guard in `seriesVolume` / `topWeightValue` / `snapTopWeight`, snapshot construction (kg conversion + `category`).
- `docs/styles.css`: day-view layout (metric chips, group headers, set rows, badges).
- `docs/sw.js`: cache version bump (app shell changed).
- Data: no migration of stored state; legacy lb snapshots stay as-is and are converted at read time. Export/import unaffected (normalizer already tolerates both shapes).
- E2E: new coverage for heatmap tap → day view, navigation, and metric values.
