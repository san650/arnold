# workout-accordion Specification (delta)

## ADDED Requirements

### Requirement: Single-expansion accordion

The workout screen SHALL render exercise cards as an accordion in which at
most one exercise is expanded at any time. All other exercise cards SHALL be
collapsed. An all-collapsed state is valid.

#### Scenario: Expanding one collapses the other

- **WHEN** exercise A is expanded and the user taps collapsed exercise B
- **THEN** B becomes expanded and A becomes collapsed

#### Scenario: Collapsing the expanded exercise

- **WHEN** the user taps the header of the currently expanded exercise
- **THEN** it collapses and no exercise is expanded

### Requirement: Collapsed card content

A collapsed exercise card SHALL show only the exercise name, its notes (if
any), and its stat chips (series count; weights or duration). Set rows and the
media panel SHALL NOT be rendered while collapsed.

#### Scenario: Collapsed card hides sets and media

- **WHEN** an exercise with 3 sets and a video URL is collapsed
- **THEN** the card shows the name, notes, and chips, and contains no set
  toggles and no media panel

#### Scenario: Expanded card shows everything

- **WHEN** that exercise is expanded
- **THEN** the card additionally shows its set rows and its media panel

### Requirement: Initial expansion on entry

On entering the workout screen, the first exercise (in routine order) whose
sets are not all complete for today SHALL start expanded. If every exercise is
complete, or the routine is empty, all cards SHALL start collapsed.

#### Scenario: Resume at first incomplete

- **WHEN** the user opens a routine where exercises 1–2 are complete and 3 is
  not
- **THEN** exercise 3 starts expanded and all others start collapsed

#### Scenario: All complete

- **WHEN** the user opens a routine where every exercise is complete
- **THEN** all cards start collapsed

### Requirement: No auto-advance on completion

Completing the last set of the expanded exercise SHALL NOT change the
expansion state. The exercise SHALL remain expanded (with its complete
highlight) until the user manually collapses it or expands another.

#### Scenario: Last set completed

- **WHEN** the user marks the final incomplete set of the expanded exercise
- **THEN** the exercise stays expanded and gains the complete highlight

#### Scenario: Unchecking after completion

- **WHEN** the exercise remains expanded after completion
- **THEN** the user can uncheck any of its sets without extra taps

### Requirement: Completed exercises stay reachable

Tapping a collapsed card SHALL expand it regardless of completion state, so a
completed exercise's sets and weights remain reviewable and editable.

#### Scenario: Reopen a completed exercise

- **WHEN** the user taps a collapsed, completed (orange-highlighted) exercise
- **THEN** it expands and its checked set rows are visible and toggleable

### Requirement: Edit mode renders all collapsed

In workout edit mode (reorder/edit/remove), all exercise cards SHALL render
collapsed and the expand interaction SHALL be disabled. Edit affordances
(drag handle, edit and remove buttons) SHALL remain functional.

#### Scenario: Edit mode is compact

- **WHEN** the user enters edit mode on a routine
- **THEN** every card is collapsed and tapping a card body does not expand it

### Requirement: Transient expansion state

Expansion state SHALL be in-memory only — never persisted and never encoded in
the URL — and SHALL reset on navigation, so re-entering the screen re-applies
the initial-expansion rule.

#### Scenario: State resets on navigation

- **WHEN** the user expands exercise 5, navigates home, and returns to the
  routine
- **THEN** the initial-expansion rule applies again (first incomplete exercise
  expanded), not exercise 5

### Requirement: Completion highlight preserved

The existing completed-exercise highlight (orange accent border) SHALL apply
identically to collapsed and expanded cards.

#### Scenario: Collapsed complete card

- **WHEN** a complete exercise is collapsed
- **THEN** its card shows the orange accent border
