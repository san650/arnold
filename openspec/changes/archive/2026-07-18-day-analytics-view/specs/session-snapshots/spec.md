# session-snapshots Delta

## ADDED Requirements

### Requirement: Snapshots store weights in kg

When a session snapshot is written for an exercise whose unit is `lb`, each
series weight SHALL be converted to kg (`value × 0.45359237`, rounded to one
decimal) and the snapshot's `unit` SHALL be `'kg'`. Exercise definitions
(catalog and routine series) SHALL keep their configured unit — only the
frozen history copy is normalized.

#### Scenario: lb exercise produces kg snapshot

- **WHEN** a set is toggled on an exercise configured as 100 lb × 5, unit `lb`
- **THEN** the stored snapshot series has `weight: 45.4` and `unit: 'kg'`,
  while the exercise definition still reads 100 lb

#### Scenario: kg exercise unchanged

- **WHEN** a set is toggled on a kg exercise
- **THEN** the snapshot series weights are stored verbatim with `unit: 'kg'`

### Requirement: Legacy lb snapshots convert at read time

Volume and top-weight computations over snapshots SHALL treat stored weights
according to the snapshot's `unit`, converting lb to kg. Stored data SHALL NOT
be migrated; already-persisted lb snapshots remain valid indefinitely
(including re-imports of old exports).

#### Scenario: Legacy snapshot volume

- **WHEN** volume is computed for a stored snapshot with `unit: 'lb'` and
  series 100×5
- **THEN** the result is in kg (≈226.8), not 500

#### Scenario: Import of an old export

- **WHEN** the user imports an export containing lb snapshots
- **THEN** the import succeeds unmodified and metrics compute in kg

### Requirement: Snapshots record category

New session snapshots SHALL include the exercise's `category` from its catalog
entry (`null` when the catalog entry has none). Readers needing a category for
older snapshots SHALL fall back to catalog lookup by normalized name, then the
`categoryOf` keyword guess.

#### Scenario: Category frozen at write time

- **WHEN** a set is toggled on a catalog exercise categorized `piernas`
- **THEN** the stored snapshot includes `category: 'piernas'`

#### Scenario: Category survives catalog deletion

- **WHEN** the exercise is later deleted from the catalog
- **THEN** day-view chips for past days still resolve `piernas` from the
  snapshot
