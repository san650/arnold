@smoke
Feature: Home screen
  As a lifter
  I want to see my week's routines and jump into a workout

  Background:
    Given I open the app

  Scenario: The week's routines are listed
    Then I should see "Rutinas"
    And I should see "Tren Superior (Empuje)"
    And I should see 7 routines

  Scenario Outline: Rest days are marked as such
    Then the routine "<name>" is shown as a rest day

    Examples:
      | name              |
      | Descanso o Cardio |
      | Descanso          |

  Scenario: Opening a routine shows its exercises
    When I open the routine "Tren Superior (Empuje)"
    Then I should see "Press de banca con barra"
