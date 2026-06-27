Feature: Editing a routine's exercises
  As a lifter
  I want to add and remove exercises in a routine

  Scenario: Adding an exercise from the catalog
    Given I open the routine editor for "day1"
    When I tap the add-exercise button
    And I pick "Peso muerto con barra" from the catalog
    Then routine "day1" should reference "Peso muerto con barra" in storage
    And routine "day1" should have 6 exercises in storage

  Scenario: Removing an exercise
    Given I open the routine editor for "day1"
    When I remove the first exercise
    And I confirm the dialog
    Then routine "day1" should have 4 exercises in storage
