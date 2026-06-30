@catalog
Feature: Exercise catalog
  As a lifter
  I want to browse and search the catalog of exercises

  Background:
    Given I open the catalog

  Scenario: The catalog lists every exercise once
    Then I should see "Catálogo"
    And the catalog should list 18 exercises

  Scenario: An exercise used by several routines lists each one
    Then I should see "Día 02 + Día 05"

  Scenario: Searching filters the list
    When I search the catalog for "press"
    Then the catalog should list 4 exercises

  Scenario: Opening an exercise shows its detail
    When I open the exercise "Press de banca con barra"
    Then I should see "Sesiones"
