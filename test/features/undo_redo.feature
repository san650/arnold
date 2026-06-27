Feature: Undo and redo
  As a lifter
  I want to undo and redo my edits

  Scenario: Undoing and redoing a routine rename
    Given I open the routines editor
    When I rename the routine "day1" to "Cambiado"
    Then routine "day1" should be named "Cambiado"
    When I undo
    Then routine "day1" should be named "Día 1: Tren Superior (Empuje)"
    When I redo
    Then routine "day1" should be named "Cambiado"
