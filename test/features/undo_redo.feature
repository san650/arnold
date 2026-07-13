@undo
Feature: Undo and redo
  As a lifter
  I want to undo and redo my edits

  Scenario: Undoing and redoing a routine rename
    Given I open the routines editor
    When I rename the routine "day1" to "Cambiado"
    Then routine "day1" should be named "Cambiado"
    When I undo
    Then routine "day1" should be named "Tren Superior (Empuje)"
    When I redo
    Then routine "day1" should be named "Cambiado"

  Scenario: Undoing and redoing a completed set
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    Then the workout should have 1 completed set in storage
    When I undo
    Then the workout should have 0 completed set in storage
    When I redo
    Then the workout should have 1 completed set in storage

  Scenario: Undoing a weight edit also reverts its cascade
    Given I open the routine editor for "day1"
    When I open the editor for the first exercise
    And I set the weight of series 1 to "60"
    Then every series of routine "day1" should weigh "60" in storage
    When I finish editing the exercise
    And I undo
    Then series 1 of routine "day1" should have no weight in storage

  Scenario: A new edit clears the redo stack
    Given I open the routines editor
    When I rename the routine "day1" to "Primero"
    And I undo
    And I rename the routine "day2" to "Segundo"
    Then I cannot redo
