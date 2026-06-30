@log
Feature: Action log
  As a lifter
  I want a record of the changes I've made

  Scenario: The log starts empty
    Given I open the log
    Then I should see "Sin acciones todavía"

  Scenario: A logged set is recorded in the log
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I open the log
    Then I should see "Marcaste la serie 1"
