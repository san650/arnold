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

  Scenario: The first incomplete exercise starts expanded
    Then exercise 1 should be expanded
    And exercise 2 should be collapsed

  Scenario: A collapsed exercise hides its sets
    Then exercise 2 should show no sets

  Scenario: Expanding another exercise collapses the current one
    When I expand exercise 2
    Then exercise 2 should be expanded
    And exercise 1 should be collapsed

  Scenario: Collapsing the expanded exercise leaves all collapsed
    When I collapse the expanded exercise
    Then all exercises should be collapsed

  Scenario: Completing an exercise keeps it expanded
    Given I complete every set of the expanded exercise
    Then exercise 1 should be expanded

  Scenario: A completed exercise can be reopened
    Given I complete every set of the expanded exercise
    And I expand exercise 2
    When I expand exercise 1
    Then exercise 1 should be expanded

  Scenario: Re-entering the routine resumes at the first incomplete exercise
    Given I complete every set of the expanded exercise
    When I return home
    And I open the routine "Tren Superior (Empuje)"
    Then exercise 2 should be expanded
    And exercise 1 should be collapsed
