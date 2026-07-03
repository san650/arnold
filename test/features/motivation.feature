@smoke
Feature: Daily motivation
  As a lifter
  I want a motivational quote when I tap the title

  Scenario: Tapping the title shows the daily quote and returns
    Given I open the app
    When I open the daily motivation
    Then I should see "tocá para volver"
    When I return home from the motivation screen
    Then I should see "Rutinas"
