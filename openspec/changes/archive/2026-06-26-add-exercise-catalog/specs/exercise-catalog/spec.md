## ADDED Requirements

### Requirement: Standalone exercise definitions

The document SHALL hold a `catalog` array of standalone exercise definitions,
each carrying identity only: `{ id, name, kind, video, notes }`. Definitions
MUST NOT carry routine parameters (sets, reps, duration, weight).

#### Scenario: Create a definition

- **WHEN** the user submits the create-exercise form with a name and type
- **THEN** a new definition is appended to `catalog` and appears in the manager
  list

#### Scenario: Definition carries no routine params

- **WHEN** a definition is added to a routine
- **THEN** routine params (sets/reps/weight) come from routine defaults, not the
  definition

### Requirement: Unified catalog list

The catalog manager SHALL show a single list merging routine exercise instances
and standalone definitions, de-duplicated by normalized name, filterable by name.

#### Scenario: Dedup by normalized name

- **WHEN** a standalone definition shares a normalized name with a routine
  exercise
- **THEN** the list shows one row, not two

#### Scenario: Filter the list

- **WHEN** the user types in the filter field
- **THEN** the list shows only exercises whose normalized name contains the query

### Requirement: Delete only unused definitions

A catalog definition SHALL be deletable only when it is used by no routine.
Deletion MUST be undoable, restoring the definition at its original position.
The UI SHALL explain that a used exercise must first be removed from its
routines.

#### Scenario: Delete an unused definition

- **WHEN** the user deletes a definition not used in any routine
- **THEN** it is removed from `catalog`, and undo restores it at the same index

#### Scenario: Used exercise is not deletable

- **WHEN** an exercise is used by at least one routine
- **THEN** the delete affordance is hidden/disabled and an explanation is shown

### Requirement: Definition-level edits stay in sync

Editing a definition-level field (name, kind, video, notes) SHALL update both the
standalone definition and every routine instance sharing its normalized name.
Routine-only fields MUST NOT propagate to the definition.

#### Scenario: Rename syncs everywhere

- **WHEN** the user renames an exercise that has both a definition and routine
  instances
- **THEN** the definition and all matching routine instances receive the new name

#### Scenario: Routine-only field does not sync

- **WHEN** the user changes a routine instance's sets or weight
- **THEN** the standalone definition is unchanged
