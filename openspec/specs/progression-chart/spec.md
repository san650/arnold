# progression-chart Specification

## Purpose

Define how the progression chart and dashboard sparkline compute per-session
values from the structured series model, using total volume for `reps`
exercises and duration for `time` exercises.

## Requirements

### Requirement: Progression measured by total volume

The progression chart and dashboard sparkline SHALL use total session volume
(`Σ(weight × reps)` over the snapshot's series) for `reps` exercises, and the
leading number of the duration for `time` exercises.

#### Scenario: Volume for a session

- **WHEN** a session's series is 60×12, 70×10, 80×8 kg
- **THEN** the chart value for that session is 2060

#### Scenario: Set with missing weight or reps

- **WHEN** a set has a null weight or null reps
- **THEN** that set contributes 0 to the session's volume

#### Scenario: Time exercise uses duration

- **WHEN** the exercise is `time` with duration `"45 min"`
- **THEN** the chart value is 45
