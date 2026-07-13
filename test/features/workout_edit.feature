@workout
Feature: Editing a routine's exercises
  As a lifter
  I want to add, remove, reorder, and tune the exercises in a routine

  Background:
    Given I open the routine editor for "day1"

  Scenario: Edit mode shows every exercise collapsed
    Then all exercises should be collapsed

  Scenario: Adding an exercise from the catalog
    When I add the exercise "Peso muerto con barra" to the routine
    Then routine "day1" should reference "Peso muerto con barra" in storage
    And routine "day1" should have 6 exercises in storage

  Scenario: Removing an exercise
    When I remove the first exercise
    And I confirm the dialog
    Then routine "day1" should have 4 exercises in storage

  Scenario: Reordering exercises
    When I move the first exercise below the second
    Then exercise 1 of routine "day1" should be "Press militar con barra" in storage
    And exercise 2 of routine "day1" should be "Press de banca con barra" in storage

  Scenario: Editing a set's weight and reps
    When I open the editor for the first exercise
    And I set the first series to "60" by "8"
    Then the first series of routine "day1" should be "60" by "8" in storage

  Scenario: Entering a weight fills the empty series below
    When I open the editor for the first exercise
    And I set the weight of series 1 to "60"
    Then every series of routine "day1" should weigh "60" in storage

  Scenario: A cascaded weight never overwrites an entered one
    When I open the editor for the first exercise
    And I set the weight of series 2 to "70"
    And I set the weight of series 1 to "60"
    Then series 1 of routine "day1" should weigh "60" in storage
    And series 2 of routine "day1" should weigh "70" in storage
    And series 3 of routine "day1" should weigh "70" in storage

  Scenario: The weight cascade only flows downward
    When I open the editor for the first exercise
    And I set the weight of series 2 to "70"
    Then series 1 of routine "day1" should have no weight in storage
    And series 3 of routine "day1" should weigh "70" in storage

  Scenario Outline: Adjusting the number of series
    When I open the editor for the first exercise
    And I change the series count by <delta>
    Then exercise 1 of routine "day1" should have <count> series in storage

    Examples:
      | delta | count |
      |     1 |     4 |
      |    -1 |     2 |

  Scenario: Switching an exercise to a timed type
    When I open the editor for the first exercise
    And I change the exercise type to "time"
    Then the first series of routine "day1" should have a duration in storage

  Scenario: The series count cannot go below one
    When I open the editor for the first exercise
    And I change the series count by -2
    Then exercise 1 of routine "day1" should have 1 series in storage
    And I cannot remove more series

  Scenario: Changing an exercise's type cascades to every routine that uses it
    Given I open the routine editor for "day2"
    When I open the editor for the first exercise
    And I change the exercise type to "time"
    Then the first series of routine "day2" should have a duration in storage
    And the first series of routine "day5" should have a duration in storage
