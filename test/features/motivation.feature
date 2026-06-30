@smoke
Feature: Daily motivation
  As a lifter
  I want a motivational quote when I tap the title

  Scenario: Tapping the title shows the daily quote and returns
    Given I open the app
    When I tap the title
    Then I should see "tocá para volver"
    When I tap to return
    Then I should see "Rutinas"
