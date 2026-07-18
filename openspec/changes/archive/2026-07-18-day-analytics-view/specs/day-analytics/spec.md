# day-analytics Delta

## ADDED Requirements

### Requirement: Day view route

The app SHALL render a read-only day view at `#/dashboard/day/:date` where
`:date` is a `YYYY-MM-DD` key. An invalid date segment SHALL bounce to
`#/dashboard` via `history.replaceState` (no dead page on refresh).

#### Scenario: Deep link to a trained day

- **WHEN** the user opens `#/dashboard/day/2026-07-16` and that day has sessions
- **THEN** the day view for 2026-07-16 renders

#### Scenario: Invalid date bounces

- **WHEN** the user opens `#/dashboard/day/not-a-date`
- **THEN** the URL is replaced with `#/dashboard` and the dashboard renders

### Requirement: Heatmap cells open the day view

Each non-future heatmap cell SHALL be tappable and navigate to the day view for
its date. Future cells SHALL remain inert.

#### Scenario: Tap a trained day

- **WHEN** the user taps a heatmap cell with activity
- **THEN** the app navigates to `#/dashboard/day/<that date>`

#### Scenario: Tap a rest day

- **WHEN** the user taps a past cell with no activity
- **THEN** the day view opens showing the rest-day state

#### Scenario: Tap a future day

- **WHEN** the user taps a cell for a date after today
- **THEN** nothing happens

### Requirement: Trained-day navigation

The day view header SHALL show prev/next controls that navigate to the nearest
trained day strictly before/after the viewed date (a trained day is one with at
least one completed set). A control with no target SHALL be disabled.

#### Scenario: Chevrons skip rest days

- **WHEN** the user views 2026-07-16 and the surrounding trained days are
  2026-07-12 and 2026-07-19
- **THEN** prev navigates to `#/dashboard/day/2026-07-12` and next to
  `#/dashboard/day/2026-07-19`

#### Scenario: Edge of history

- **WHEN** no trained day exists before the viewed date
- **THEN** the prev control is disabled

#### Scenario: Navigation from a rest day

- **WHEN** the user views a rest day between two trained days
- **THEN** prev/next navigate to those trained days

### Requirement: Day metrics

The day view SHALL show, for the viewed date: total volume in kg (sum of
`weight × reps` over completed data, lb converted to kg), sets done over sets
planned, count of exercises with at least one done set, and PR count. Volume
SHALL be computed in kg regardless of each snapshot's stored unit.

#### Scenario: Metrics for a trained day

- **WHEN** the day has two exercises — 3/3 sets of 80 kg × 8 and 1/2 sets of
  100 kg × 5 — and one is a PR
- **THEN** the chips show 2420 kg volume, 4/5 series, 2 ejercicios, 1 PR

#### Scenario: Mixed-unit day sums in kg

- **WHEN** the day includes a legacy snapshot in lb and another in kg
- **THEN** the lb weights are converted to kg before being added to the total

### Requirement: Muscle-group chips

The day view SHALL show deduplicated muscle-group chips for the exercises with
at least one done set, resolving each exercise's category as: snapshot
`category`, else catalog lookup by normalized name, else the `categoryOf`
keyword fallback.

#### Scenario: Chips deduplicate

- **WHEN** the day has two `piernas` exercises and one `espalda` exercise
- **THEN** exactly two chips render: Piernas and Espalda

### Requirement: Routine-grouped exercise list

The day view SHALL list the day's exercises grouped by the snapshot's
`routineId`, showing per set its done state and weight × reps (kg) or duration.
The group label SHALL resolve from current routines, falling back for deleted
routines; sessions without `routineId` group under a generic label. An
exercise whose top set is a PR SHALL show a PR badge.

#### Scenario: Grouping by routine

- **WHEN** the day has sessions from routine A and routine B
- **THEN** two groups render, each labeled with its routine's name

#### Scenario: Deleted routine still groups

- **WHEN** a session's `routineId` no longer exists in `doc.routines`
- **THEN** its exercises still render in one group with a fallback label

### Requirement: PR detection

An exercise on day D SHALL be marked as a PR when its top-set weight in kg
strictly exceeds the maximum top-set weight (kg) across all earlier sessions of
the same normalized exercise name. The first-ever session of an exercise SHALL
NOT count as a PR.

#### Scenario: New top weight

- **WHEN** an exercise's prior best top set is 80 kg and the viewed day's top
  set is 85 kg
- **THEN** the exercise shows a PR badge and the PR count includes it

#### Scenario: First session is not a PR

- **WHEN** the viewed day contains the first-ever session of an exercise
- **THEN** no PR badge is shown for it

#### Scenario: Cross-unit comparison

- **WHEN** the prior best is a legacy 176 lb snapshot (79.8 kg) and the viewed
  day's top set is 80 kg
- **THEN** the exercise is a PR

### Requirement: Per-routine volume delta

Each routine group SHALL show the percentage change of its kg volume vs. the
most recent earlier day on which that same `routineId` was trained, labeled
with that date. If no earlier day exists for the routine, or the group has no
`routineId`, no delta SHALL be shown.

#### Scenario: Delta vs. last same-routine day

- **WHEN** routine A's volume today is 2100 kg and its previous occurrence on
  12 jul was 2000 kg
- **THEN** the group header shows a +5% delta referencing 12 jul

#### Scenario: First time a routine is trained

- **WHEN** the viewed day is the first day routine A appears in history
- **THEN** its group shows no delta

### Requirement: Rest-day state

A viewed day with no completed sets SHALL render a rest-day ("Descanso") state
instead of metrics and exercise groups, with trained-day navigation still
available.

#### Scenario: Rest day renders

- **WHEN** the user opens the day view for a past day with no done sets
- **THEN** the Descanso state renders and the chevrons navigate to the nearest
  trained days
