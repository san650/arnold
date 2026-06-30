@dashboard
Feature: Progress dashboard
  As a lifter
  I want logged work to show up on my progress screen

  Background:
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete

  Scenario: Logged work appears on the dashboard
    When I open the progress screen
    Then I should see "Progreso"
    And I should see "Actividad"
    And I should see "Press de banca con barra"

  Scenario: A latest-exercise card opens its detail
    When I open the progress screen
    And I open the exercise "Press de banca con barra"
    Then I should see "Sesiones"
