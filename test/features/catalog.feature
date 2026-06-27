Feature: Exercise catalog
  As a lifter
  I want to browse and search the catalog of exercises

  Scenario: The catalog lists every exercise once
    Given I open the catalog
    Then I should see "Catálogo"
    And the catalog should list 18 exercises

  Scenario: A shared exercise shows every routine that uses it
    Given I open the catalog
    Then I should see "Día 02 + Día 05"

  Scenario: Searching filters the list
    Given I open the catalog
    When I search the catalog for "press"
    Then the catalog should list 4 exercises

  Scenario: Opening an exercise shows its detail
    Given I open the catalog
    When I open the exercise "Press de banca con barra"
    Then I should see "Sesiones"
