Feature: Home screen
  As a lifter
  I want to see my week's routines and jump into a workout

  Scenario: The week's routines are listed
    Given I open the app
    Then I should see "Rutinas"
    And I should see "Tren Superior (Empuje)"
    And I should see 7 routines

  Scenario: Rest days are marked
    Given I open the app
    Then I should see "Día de descanso"

  Scenario: Opening a routine shows its exercises
    Given I open the routine "Tren Superior (Empuje)"
    Then I should see "Press de banca con barra"
