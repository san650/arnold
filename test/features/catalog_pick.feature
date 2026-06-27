Feature: Adding an exercise to a routine from the catalog
  As a lifter
  I want to pick a catalog exercise to add to a routine

  Scenario: Picking an existing exercise inserts a reference
    Given I open the routine editor for "day1"
    When I tap the add-exercise button
    Then I should see "Agregar ejercicio"
    When I pick "Peso muerto con barra" from the catalog
    Then routine "day1" should reference "Peso muerto con barra" in storage
    And routine "day1" should have 6 exercises in storage
