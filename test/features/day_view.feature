@dashboard
Feature: Day analytics
  As a lifter
  I want to open a day from my activity calendar
  So I can review what I lifted and how it compares

  Scenario: Today's work opens from the activity calendar
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I open the progress screen
    And I open today in the activity calendar
    Then the day view should list "Press de banca con barra"

  Scenario: A day without training shows as rest
    Given I open the progress screen
    When I open yesterday in the activity calendar
    Then the day view should show a rest day

  Scenario: Future days are not tappable
    Given I open the progress screen
    Then tomorrow is not tappable in the activity calendar

  Scenario: Day metrics summarize volume, sets, and records
    Given a recorded squat history
    When I open the day from 2 days ago
    Then the day metrics should include "2040"
    And the day metrics should include "3/3"
    And the day view should show the muscle group "Piernas"
    And the exercise "Sentadilla con barra" should be marked as a personal record
    And the routine comparison should show "+6%"

  Scenario: Day navigation skips rest days
    Given a recorded squat history
    When I open the day from 2 days ago
    And I go to the previous training day
    Then the day metrics should include "1920"

  Scenario: Day navigation stops at the edges of history
    Given a recorded squat history
    When I open the day from 2 days ago
    Then the next training day control should be disabled
    When I go to the previous training day
    Then the previous training day control should be disabled

  Scenario: An invalid day link falls back to the progress screen
    When I open an invalid day link
    Then I should see "Progreso"

  Scenario: A set logged in pounds is stored in kilograms
    Given my routine measures the first exercise in pounds
    And I open the routine "Tren Superior (Tirón)"
    And I mark the first set complete
    Then the stored session should record the weight in kilograms

  Scenario: A legacy history in pounds sums in kilograms
    Given a legacy history recorded in pounds
    When I open the day from 4 days ago
    Then the day metrics should include "227"
