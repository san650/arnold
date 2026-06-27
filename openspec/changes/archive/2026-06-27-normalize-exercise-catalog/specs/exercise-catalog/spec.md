## MODIFIED Requirements

### Requirement: Standalone exercise definitions

The document SHALL hold a `catalog` array that is the source of truth for
exercise definitions, each carrying `{ id, name, kind, video, notes, unit }` and
unique by normalized name. A routine exercise SHALL be a reference to a catalog
entry plus per-instance training params: `{ catalogId, series }`. Definitions
MUST NOT carry per-instance training params (the per-set `series`); instances
MUST NOT carry definition fields (name/kind/video/notes/unit).

#### Scenario: Create a definition

- **WHEN** the user submits the create-exercise form with a name and type
- **THEN** a new entry is appended to `catalog` and appears in the catalog list

#### Scenario: Routine exercise references a definition

- **WHEN** an exercise is added to a routine
- **THEN** the routine stores `{ catalogId, series }`, with `series` from routine
  defaults and all definition fields resolved from the catalog entry

#### Scenario: Catalog is unique by normalized name

- **WHEN** two exercises share a normalized name
- **THEN** they resolve to a single catalog entry; references point at the same
  `catalogId`

## ADDED Requirements

### Requirement: Definition edits propagate to all references

Editing a definition field (name, kind, video, notes, unit) SHALL update the
single catalog entry, and every routine reference SHALL reflect the change
without a separate sync step. Changing `kind` SHALL reshape the `series` of every
referencing instance. Edits MUST be undoable exactly.

#### Scenario: Rename propagates everywhere

- **WHEN** the user renames an exercise used by several routines
- **THEN** the catalog entry's name changes and every routine showing that
  exercise reflects the new name immediately

#### Scenario: Changing kind reshapes referencing instances

- **WHEN** the user changes an exercise's `kind` from reps to time
- **THEN** the `series` of every routine instance referencing it is reshaped to
  the new kind, and undo restores both the kind and the prior series

#### Scenario: Per-instance series does not touch the definition

- **WHEN** the user edits one routine instance's sets/weights/reps
- **THEN** only that instance's `series` changes; the catalog entry is unchanged

### Requirement: Delete cascades to routines

Deleting a catalog entry SHALL remove the entry and every routine reference to
it across all routines. Logged sessions MUST be preserved as historical records.
The delete confirmation SHALL enumerate the affected routines (by day) and state
that sessions are kept. Deletion MUST be undoable, restoring the entry and every
routine reference at its original position.

#### Scenario: Delete an in-use exercise

- **WHEN** the user deletes an exercise used by one or more routines
- **THEN** the entry is removed from `catalog`, every reference is removed from
  its routines, logged sessions remain, and undo restores the entry and all
  references at their original positions

#### Scenario: Confirmation names affected days

- **WHEN** the user triggers deletion of an in-use exercise
- **THEN** the confirmation lists the affected days (e.g. "Día 02, Día 05") and
  notes that logged sessions are kept

### Requirement: Catalog screen with view and edit modes

The catalog SHALL be presented on its own screen at `#/catalog`, not in a drawer.
In view mode the list SHALL be navigable (selecting a row opens the exercise's
detail). An "Editar" control SHALL switch to edit mode (`#/catalog/edit`), in
which the user can add, edit, and delete exercises; a "Listo" control SHALL
return to view mode. The list SHALL be filterable by name in both modes.

#### Scenario: Navigate in view mode

- **WHEN** the user selects an exercise row in view mode
- **THEN** the app navigates to that exercise's detail at `#/catalog/ex/<slug>`,
  whose back action returns to `#/catalog`

#### Scenario: Enter edit mode to manage exercises

- **WHEN** the user taps "Editar" on the catalog screen
- **THEN** the screen enters edit mode exposing add, per-row edit, and per-row
  delete affordances

#### Scenario: Create from edit mode

- **WHEN** the user taps the add control in edit mode and submits the form
- **THEN** a new catalog entry is created and appears in the list

### Requirement: Pick an exercise for a routine

From the workout editor, the user SHALL reach the catalog in a pick mode at
`#/catalog/pick/<routineId>` to insert an exercise into that routine. Selecting
an existing exercise SHALL add a reference to the routine and return to the
workout editor. Creating a new exercise from pick mode SHALL create the catalog
entry, add a reference to the routine, and open that instance for editing.

#### Scenario: Pick an existing exercise

- **WHEN** the user selects an exercise in pick mode for a routine
- **THEN** a `{ catalogId, series }` reference is appended to that routine and
  the app returns to `#/workout/<routineId>/edit`

#### Scenario: Create new while picking

- **WHEN** the user creates a new exercise from pick mode
- **THEN** a catalog entry is created, a reference is added to the routine, and
  that instance opens for editing

## REMOVED Requirements

### Requirement: Unified catalog list

**Reason**: The catalog is no longer a derived union of routine instances and
standalone definitions; it is the stored source of truth. De-duplication happens
at write/migration time, not at render time.

**Migration**: A one-way migration builds the canonical `catalog` from existing
routine exercises (deduped by normalized name) and existing orphan definitions,
and rewrites routine exercises to references. The catalog list reads
`doc.catalog` directly.

### Requirement: Delete only unused definitions

**Reason**: Deletion now cascades to routines, so the "unused only" gate is
removed. Replaced by "Delete cascades to routines".

**Migration**: None — the gate and its explanatory copy are removed; the cascade
delete path with day-enumerating confirmation replaces it.

### Requirement: Definition-level edits stay in sync

**Reason**: With one canonical definition referenced by routines, there are no
instance copies to keep in sync; the bulk-sync commands (`CATALOG_RENAME`,
`CATALOG_UPDATE_FIELD`) are removed. Replaced by "Definition edits propagate to
all references".

**Migration**: None — instances stop carrying definition fields; edits target the
single catalog entry.
