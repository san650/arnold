## ADDED Requirements

### Requirement: Fresh-install data model, no migration

The application SHALL assume a fresh install: the seed document ships in the
normalized model (a `catalog` of definitions plus routines holding
`{ id, catalogId, series }` references), and there SHALL be no document
migration or `schemaVersion` handling. Persisted state is loaded as-is, and
importing a document does not transform its shape.

#### Scenario: Seed is already normalized

- **WHEN** the app starts with empty storage
- **THEN** it seeds a normalized document (catalog entries + routine references)
  with no migration step

#### Scenario: No migration on load or import

- **WHEN** persisted state is loaded, or a document is imported
- **THEN** it is used as-is, with no shape conversion or version check
