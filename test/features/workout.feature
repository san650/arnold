Feature: Logging a workout
  As a lifter
  I want to mark sets complete and track the day's progress

  Scenario: Marking a set updates the day's progress
    Given I open the routine "Tren Superior (Empuje)"
    Then the day progress should be "00 / 15"
    When I mark the first set complete
    Then the day progress should be "01 / 15"
    And the workout should have 1 completed set in storage

  Scenario: Resetting the day's checklist
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I tap "Volver a empezar"
    And I confirm the dialog
    Then the day progress should be "00 / 15"
