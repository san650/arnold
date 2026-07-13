## MODIFIED Requirements

### Requirement: Series-table editor

The exercise editor SHALL present, for `reps` exercises, one row per set with a
weight input and a reps input, a set-count stepper, and a shared unit selector.
For `time` exercises it SHALL present a set-count stepper and a single duration
field. Every edit SHALL dispatch `UPDATE_SERIES` (there is no `SET_WEIGHT`
command).

Committing a weight or reps value on set *i* SHALL also set that field on every
set below *i* whose current value is null. The cascade SHALL NOT overwrite a
non-null value, SHALL NOT flow upward, and SHALL treat weight and reps
independently. The edit and its cascade SHALL land in a single `UPDATE_SERIES`
command, so one undo reverts both.

#### Scenario: Edit a single set's weight and reps

- **WHEN** the user changes set 3 to 80 kg × 8 reps
- **THEN** `series[2]` becomes `{weight:80,reps:8}` via an `UPDATE_SERIES`
  command that is undoable

#### Scenario: Switch kind reshapes series

- **WHEN** the user changes an exercise from `reps` to `time`
- **THEN** each series entry is reshaped to `{ duration }` of the same length

#### Scenario: Filling the first set fills the blanks below

- **WHEN** a 3-set exercise has all-null series and the user commits 60 on
  set 1's weight
- **THEN** every set's weight becomes 60 and every set's reps remains null

#### Scenario: Cascade never overwrites entered values

- **WHEN** series weights are `[60, 70, null]` and the user commits 65 on
  set 1's weight
- **THEN** weights become `[65, 70, 65]` — set 2 keeps its value, the null
  set 3 is filled

#### Scenario: Cascade only flows downward

- **WHEN** series weights are `[null, 60, null]` and the user commits 70 on
  set 2's weight
- **THEN** weights become `[null, 70, 70]` — set 1 stays null
