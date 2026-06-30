@data
Feature: Backing up and restoring data
  As a lifter
  I want to export, import, and reset my configuration

  Scenario: Resetting to the starter routines
    Given I open the routines editor
    And I delete the routine "day7"
    And I confirm the dialog
    Then there should be 6 routines in storage
    When I reset to the starter routines
    Then there should be 7 routines in storage

  Scenario: Importing replaces all routines
    Given I open the app
    When I import the file "two_routines.json"
    And I confirm the dialog
    Then there should be 2 routines in storage

  Scenario: Exporting downloads a backup file
    Given I open the app
    When I export the configuration
    Then a file named like "arnold-" should download
