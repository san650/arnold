Feature: Editing routines
  As a lifter
  I want to rename, add, and remove routines

  Scenario: Renaming a routine
    Given I open the routines editor
    When I rename the routine "day1" to "Día 1: Empuje Pesado"
    Then routine "day1" should be named "Día 1: Empuje Pesado"

  Scenario: Adding a routine
    Given I open the routines editor
    When I add a routine named "Día 8: Cardio"
    Then I should see "Día 8: Cardio"
    And there should be 8 routines in storage

  Scenario: Deleting a routine
    Given I open the routines editor
    When I delete the routine "day7"
    And I confirm the dialog
    Then there should be 6 routines in storage
