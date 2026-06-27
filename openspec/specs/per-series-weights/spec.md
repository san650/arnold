# per-series-weights Specification

## Purpose

Define how an exercise stores, edits, displays, and persists its sets as a
structured per-series model, where each set carries its own weight and reps (or
duration), with a single shared unit per exercise.

## Requirements

### Requirement: Structured series model

An exercise SHALL store its sets as a single `series` array; the set count is
`series.length`. For `reps` exercises each entry is
`{ weight: number|null, reps: number|null }`. For `time` exercises each entry is
`{ duration: string }`. A single `unit` (`kg`|`lb`) on the exercise applies to
all weights. The fields `sets`, `reps` (string), `weight`, and `weights` SHALL
NOT exist.

#### Scenario: Reps exercise shape

- **WHEN** a `reps` exercise has three sets at 60×12, 70×10, 80×8 kg
- **THEN** `series` is `[{weight:60,reps:12},{weight:70,reps:10},{weight:80,reps:8}]`
  and `unit` is `"kg"`

#### Scenario: Set count derives from series length

- **WHEN** the editor sets the count to 4
- **THEN** `series` has length 4 (new rows appended from the last entry)

### Requirement: Series-table editor

The exercise editor SHALL present, for `reps` exercises, one row per set with a
weight input and a reps input, a set-count stepper, and a shared unit selector.
For `time` exercises it SHALL present a set-count stepper and a single duration
field. Every edit SHALL dispatch `UPDATE_EXERCISE` (there is no `SET_WEIGHT`
command).

#### Scenario: Edit a single set's weight and reps

- **WHEN** the user changes set 3 to 80 kg × 8 reps
- **THEN** `series[2]` becomes `{weight:80,reps:8}` via an `UPDATE_EXERCISE`
  command that is undoable

#### Scenario: Switch kind reshapes series

- **WHEN** the user changes an exercise from `reps` to `time`
- **THEN** each series entry is reshaped to `{ duration }` of the same length

### Requirement: Per-series display during a workout

The workout view SHALL show each set's `weight × reps` target beneath its set
button, and a summary showing the weight list and total volume.

#### Scenario: Per-set targets shown

- **WHEN** a `reps` exercise renders in the workout view
- **THEN** each set button shows its own `weight × reps` (or `—` where unset)

### Requirement: Series persists into history

Completing a set SHALL snapshot `{ name, kind, routineId, unit, series }` so
history and the session list show per-series values and exact volume.

#### Scenario: Completing a set records the series

- **WHEN** the user marks a set done
- **THEN** the snapshot stores the full `series` and `unit`

### Requirement: No backward compatibility

The implementation SHALL assume a fresh install and SHALL NOT contain migration
or legacy-shape handling: no `boolean[]` session-entry path, no bare-weight
`SET_WEIGHT` payload normalization, and no legacy field shims.

#### Scenario: Session entries are always structured

- **WHEN** session data is read
- **THEN** it is always `{ sets: boolean[], snapshot }` with no array-shape
  fallback
