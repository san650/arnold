Feature: Progress dashboard
  As a lifter
  I want logged work to show up on my progress screen

  Scenario: Logged work appears on the dashboard
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I open the progress screen
    Then I should see "Progreso"
    And I should see "Actividad"
    And I should see "Press de banca con barra"
