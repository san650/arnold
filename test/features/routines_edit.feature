@routines
Feature: Editing routines
  As a lifter
  I want to rename, add, remove, and reorder routines

  Background:
    Given I open the routines editor

  Scenario: Renaming a routine
    When I rename the routine "day1" to "Día 1: Empuje Pesado"
    Then routine "day1" should be named "Día 1: Empuje Pesado"

  Scenario: Adding a routine
    When I add a routine named "Día 8: Cardio"
    Then I should see "Día 8: Cardio"
    And there should be 8 routines in storage

  Scenario: Deleting a routine
    When I delete the routine "day7"
    And I confirm the dialog
    Then there should be 6 routines in storage

  Scenario: Cancelling a delete keeps the routine
    When I delete the routine "day7"
    And I cancel the dialog
    Then the routines editor should list 7 routines

  Scenario: Reordering routines
    When I move the routine "day1" below the routine "day2"
    Then routine number 1 should be "day2" in storage
    And routine number 2 should be "day1" in storage
