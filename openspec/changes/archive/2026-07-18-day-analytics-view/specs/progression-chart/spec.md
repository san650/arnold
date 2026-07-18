# progression-chart Delta

## MODIFIED Requirements

### Requirement: Progression measured by total volume

The progression chart and dashboard sparkline SHALL use total session volume in
kg (`Σ(weight × reps)` over the snapshot's series, converting lb weights to kg
per the snapshot's `unit`) for `reps` exercises, and the leading number of the
duration for `time` exercises. Mixed-unit histories therefore chart on a single
kg scale.

#### Scenario: Volume for a session

- **WHEN** a session's series is 60×12, 70×10, 80×8 kg
- **THEN** the chart value for that session is 2060

#### Scenario: Legacy lb session on the same scale

- **WHEN** an exercise's history contains a stored `lb` snapshot of 100×5 and a
  later kg snapshot of 50×5
- **THEN** the lb session charts as ≈226.8 and the kg session as 250, on one scale

#### Scenario: Set with missing weight or reps

- **WHEN** a set has a null weight or null reps
- **THEN** that set contributes 0 to the session's volume

#### Scenario: Time exercise uses duration

- **WHEN** the exercise is `time` with duration `"45 min"`
- **THEN** the chart value is 45
