@workout
Feature: Logging a workout
  As a lifter
  I want to mark sets complete and track the day's progress

  Background:
    Given I open the routine "Tren Superior (Empuje)"

  Scenario: Marking a set updates the day's progress
    Then the day progress should be "00 / 15"
    When I mark the first set complete
    Then the day progress should be "01 / 15"
    And the workout should have 1 completed set in storage

  Scenario: Resetting the day's checklist
    Given I mark the first set complete
    When I restart today's checklist
    And I confirm the dialog
    Then the day progress should be "00 / 15"
