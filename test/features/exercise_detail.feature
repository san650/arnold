@catalog
Feature: Exercise detail
  As a lifter
  I want to see an exercise's history and edit its definition

  Scenario: Viewing an exercise's detail
    Given I open the catalog
    When I open the exercise "Sentadilla con barra"
    Then I should see "Progreso"
    And I should see "Sesiones"
    And I should see "2 rutinas"

  Scenario: Editing an exercise from its detail
    Given I open the catalog
    When I open the exercise "Plancha abdominal"
    And I tap the edit button
    Then I should see "Editar ejercicio"

  Scenario: A logged set shows up in the exercise's history
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I open the catalog
    And I open the exercise "Press de banca con barra"
    Then I should see "Día 01"
