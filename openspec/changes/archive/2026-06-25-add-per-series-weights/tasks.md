## 1. Data model & seed

- [x] 1.1 Rebuild `seed.js` exercises in the `series` shape (drop sets/reps/weight/duration)
- [x] 1.2 Add helpers: `exSeries`, `exSetCount`, `exUnit`, `seriesVolume`,
      `topWeightValue`, `repWeight` ({value,unit}), `fmtSeriesWeights`,
      `makeSeries`/`resizeSeries`/`reshapeSeries`
- [x] 1.3 Remove old per-series-weights helpers (`isPerSeries`, `exWeights`,
      `fmtWeightList`, old `repWeight`)

## 2. Remove backward compatibility

- [x] 2.1 Simplify `sessionFor` / `sessionSnapshot` (drop `boolean[]` branch)
- [x] 2.2 Simplify `entryOf` in `commands.js` (drop array-shape branch)
- [x] 2.3 Remove `SET_WEIGHT` command and `normWeightState`
- [x] 2.4 Remove the `data-weight-mode` toggle handler + selector entries

## 3. Editor

- [x] 3.1 Rewrite `renderDrawer`: series table (weight + reps per row),
      set-count stepper, unit select; single duration for `time`
- [x] 3.2 Route all edits through `UPDATE_EXERCISE` in `onChange`
      (`series-weight`, `series-reps`, `series-count`, `unit`, kind reshape)
- [x] 3.3 Update `captureUIState` focus selectors for series inputs
- [x] 3.4 Trim `renderCatalogEditDrawer` to definition fields (name/video/notes)

## 4. Workout, history & catalog

- [x] 4.1 `renderWorkout`: per-set `weight × reps`, Series/Peso/Volumen chips
- [x] 4.2 `TOGGLE_SET` snapshot = `{ name, kind, routineId, unit, series }`
- [x] 4.3 `buildExerciseHistory` rows carry `{ kind, unit, series }`
- [x] 4.4 `buildCatalog` representative weight from series; session list labels
- [x] 4.5 Update `data-pick-catalog` / `add-exercise-blank` exercise builders

## 5. Progression chart (volume)

- [x] 5.1 `barValueOf` / sparkline use `seriesVolume` for `reps`, duration for `time`
- [x] 5.2 Update chart empty-state + axis labels for volume

## 6. Styles & verification

- [x] 6.1 Series-table styles in `styles.css`
- [x] 6.2 `node --check` on app.js / commands.js / seed.js
- [x] 6.3 Smoke test: seed loads, edit series, complete sets, chart shows volume
